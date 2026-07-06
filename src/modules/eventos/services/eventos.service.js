const { db } = require('../../../config/db');
const eventosRepository = require('../repositories/eventos.repository');
const formulariosRepository = require('../../formularios/repositories/formularios.repository');
const talleresRepository = require('../../talleres/repositories/talleres.repository');
const archivosRepository = require('../../archivos/repositories/archivos.repository');
const participantesRepository = require('../../participantes/repositories/participantes.repository');

const { construirUrlPublica } = require('../../../utils/storage');

/**
 * Crea un evento nuevo, junto con sus campos de formulario (si vienen),
 * todo en una sola transacción.
 *
 * Reglas de negocio que aplican acá:
 * 1. El código debe estar libre entre los eventos "activos" (fecha_fin futura) —
 *    no es un UNIQUE de columna, lo validamos a mano (ver eventos.repository.buscarActivoPorCodigo).
 * 2. RN07: el primer evento de una organización es gratis. Se determina
 *    contando eventos existentes ANTES de insertar este. Por ahora, solo
 *    calculamos y devolvemos esa info — el pago en sí (módulo `pagos`)
 *    todavía no existe, así que no disparamos ninguna creación de `pago` acá.
 */
async function crearEvento(orgId, usuarioId, datos) {
  return db.transaction(async (trx) => {
    // 1. Validar disponibilidad del código (entre eventos vigentes)
    const eventoConEseCodigo = await eventosRepository.buscarActivoPorCodigo(datos.codigo, trx);
    if (eventoConEseCodigo) {
      const error = new Error(
        'Ese código ya está en uso por un evento vigente. Probá otro código.'
      );
      error.status = 409;
      throw error;
    }

    // 2. Determinar si es el primer evento de la organización (RN07)
    const cantidadEventosPrevios = await eventosRepository.contarPorOrganizacion(orgId, trx);
    const esPrimerEvento = cantidadEventosPrevios === 0;

    // 3. Crear el evento
    const evento = await eventosRepository.crear(
      {
        orgId,
        creadoPorUsuarioId: usuarioId,
        nombre: datos.nombre,
        descripcion: datos.descripcion,
        codigo: datos.codigo,
        fechaInicio: datos.fechaInicio,
        fechaFin: datos.fechaFin,
        politicaMenor: datos.politicaMenor,
        tieneGrupos: datos.tieneGrupos,
        tieneTalleres: datos.tieneTalleres,
        cbuCvu: datos.cbuCvu,
        aliasCobro: datos.aliasCobro,
        costo: datos.costo,
      },
      trx
    );

    // 4. Crear los campos de formulario, si vinieron
    const camposCreados = await formulariosRepository.crearVarios(
      evento.id,
      orgId,
      datos.camposForm,
      trx
    );

    const bloquesCreados = await talleresRepository.crearBloquesConTalleres(
      evento.id,
      orgId,
      datos.bloquesTaller,
      trx
    );

    return {
      evento,
      camposForm: camposCreados,
      // Informativo para el front: así puede mostrar un aviso tipo
      // "este evento es gratis" o "vas a tener que pagar la creación"
      // sin tener que calcularlo de nuevo del lado del cliente.
      // Cuando exista el módulo `pagos`, este flag es lo que va a disparar
      // la creación del registro de pago correspondiente.
      bloquesTaller: bloquesCreados,
      esPrimerEventoGratis: esPrimerEvento,
    };
  });
}

/**
 * Lista los eventos de la organización activa (la del header X-Org-Id).
 */
/**
 * Lista los eventos de la organización activa, cada uno con su cantidad
 * de inscriptos (sin traer camposForm/talleres completos, para no
 * sobrecargar la respuesta del listado).
 *
 * PENDIENTE: cantidadInscriptos hardcodeado en 0 — mismo pendiente que
 * en obtenerEvento, hasta que exista el módulo participantes.
 */
async function listarEventos(orgId) {
  const eventos = await eventosRepository.listarPorOrganizacion(orgId);

  return Promise.all(
    eventos.map(async (evento) => {
      const [portada, cantidadInscriptos] = await Promise.all([
        archivosRepository.buscarPortadaDeEvento(evento.id),
        participantesRepository.contarPorEvento(evento.id),
      ]);

      return {
        ...evento,
        cantidadInscriptos,
        imagenUrl: construirUrlPublica(portada?.key),
      };
    })
  );
}

/**
 * Busca un evento por id, verificando que pertenezca a la organización activa.
 * Esta verificación de pertenencia NO la hace el middleware (a diferencia de
 * organizaciones), porque el middleware resolverOrganizacionActiva solo sabe
 * el orgId del header — no sabe a qué organización pertenece el evento
 * que se está pidiendo por :id. Por eso se valida acá, comparando
 * evento.org_id con el orgId activo.
 */
/**
 * Busca un evento por id, con su detalle completo: campos_form, talleres,
 * y cantidad de inscriptos.
 *
 * PENDIENTE: cantidadInscriptos está hardcodeado en 0 porque el módulo
 * `participantes` todavía no existe. Cuando lo construyamos, reemplazar
 * esta línea por una query real (ej. contar filas de `participante`
 * con evento_id = este evento).
 */
async function obtenerEvento(id, orgId) {
  const evento = await eventosRepository.buscarPorId(id);

  if (!evento) {
    const error = new Error('Evento no encontrado');
    error.status = 404;
    throw error;
  }

  if (evento.org_id !== orgId) {
    const error = new Error('No tenés permisos sobre este evento');
    error.status = 403;
    throw error;
  }

  const [camposForm, bloquesTaller, portada, cantidadInscriptos] = await Promise.all([
    formulariosRepository.listarPorEvento(evento.id),
    talleresRepository.listarBloquesPorEvento(evento.id),
    archivosRepository.buscarPortadaDeEvento(evento.id),
    participantesRepository.contarPorEvento(evento.id),
  ]);

  return {
    ...evento,
    camposForm,
    bloquesTaller,
    cantidadInscriptos,
    imagenUrl: portada ? construirUrlPublica(portada.key) : null,
  };
}

/**
 * Edita un evento existente. Reusa obtenerEvento para la verificación
 * de pertenencia antes de actualizar.
 */
async function editarEvento(id, orgId, datos) {
  const evento = await obtenerEvento(id, orgId); // ya valida existencia + pertenencia

  // Si se manda fechaInicio o fechaFin (una sola, no las dos), hay que
  // validar el CHECK (fecha_fin >= fecha_inicio) contra el valor que
  // NO se está actualizando, porque la DB va a aplicar el CHECK sobre
  // la fila completa después del UPDATE.
  const fechaInicioFinal = datos.fechaInicio ?? evento.fecha_inicio;
  const fechaFinFinal = datos.fechaFin ?? evento.fecha_fin;

  if (new Date(fechaFinFinal) < new Date(fechaInicioFinal)) {
    const error = new Error('fechaFin debe ser igual o posterior a fechaInicio');
    error.status = 400;
    throw error;
  }

  const datosDb = {};
  if (datos.nombre !== undefined) datosDb.nombre = datos.nombre;
  if (datos.descripcion !== undefined) datosDb.descripcion = datos.descripcion;
  if (datos.fechaInicio !== undefined) datosDb.fecha_inicio = datos.fechaInicio;
  if (datos.fechaFin !== undefined) datosDb.fecha_fin = datos.fechaFin;
  if (datos.politicaMenor !== undefined) datosDb.politica_menor = datos.politicaMenor;
  if (datos.tieneGrupos !== undefined) datosDb.tiene_grupos = datos.tieneGrupos;
  if (datos.tieneTalleres !== undefined) datosDb.tiene_talleres = datos.tieneTalleres;
  if (datos.cbuCvu !== undefined) datosDb.cbu_cvu = datos.cbuCvu;
  if (datos.aliasCobro !== undefined) datosDb.alias_cobro = datos.aliasCobro;
  if (datos.costo !== undefined) datosDb.costo = datos.costo;

  return eventosRepository.actualizar(id, datosDb);
}

/**
 * Elimina un evento, verificando pertenencia primero.
 */
async function eliminarEvento(id, orgId) {
  await obtenerEvento(id, orgId); // valida existencia + pertenencia, descarta el resultado
  await eventosRepository.eliminar(id);
}

/**
 * Busca un evento público por su código. Solo devuelve el evento si está
 * vigente (fecha_fin no pasó) — un código de un evento finalizado no
 * debería resolver a ese evento viejo para nadie que intente inscribirse.
 *
 * Este endpoint es público (sin autenticación) — lo va a usar el formulario
 * de inscripción que ve cualquier participante, no un Admin logueado.
 */
async function buscarPorCodigoPublico(codigo) {
  const evento = await eventosRepository.buscarActivoPorCodigo(codigo);

  if (!evento) {
    const error = new Error('No se encontró ningún evento vigente con ese código');
    error.status = 404;
    throw error;
  }

  return evento;
}

/**
 * Verifica si un código de evento está disponible (no hay ningún evento
 * vigente con ese código). Requiere autenticación — solo usuarios logueados
 * (organizadores) deberían poder consultar esto, desde el formulario de
 * creación de eventos.
 *
 * Reutiliza buscarActivoPorCodigo: si devuelve algo, el código está ocupado;
 * si devuelve null/undefined, está libre.
 */
async function verificarDisponibilidadCodigo(codigo) {
  const eventoExistente = await eventosRepository.buscarActivoPorCodigo(codigo);
  return { disponible: !eventoExistente };
}

module.exports = {
  crearEvento,
  listarEventos,
  obtenerEvento,
  editarEvento,
  eliminarEvento,
  buscarPorCodigoPublico,
  verificarDisponibilidadCodigo,
};