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
  const evento = await obtenerEvento(id, orgId);

  const fechaInicioFinal = datos.fechaInicio ?? evento.fecha_inicio;
  const fechaFinFinal = datos.fechaFin ?? evento.fecha_fin;

  if (new Date(fechaFinFinal) < new Date(fechaInicioFinal)) {
    const error = new Error('fechaFin debe ser igual o posterior a fechaInicio');
    error.status = 400;
    throw error;
  }

  // Si se manda un código nuevo, validar que esté disponible
  // (no lo use otro evento vigente distinto a este)
  if (datos.codigo && datos.codigo !== evento.codigo) {
    const eventoConEseCodigo = await eventosRepository.buscarActivoPorCodigo(datos.codigo);
    if (eventoConEseCodigo && eventoConEseCodigo.id !== id) {
      const error = new Error('Ese código ya está en uso por un evento vigente');
      error.status = 409;
      throw error;
    }
  }

  const datosDb = {};
  if (datos.nombre !== undefined) datosDb.nombre = datos.nombre;
  if (datos.descripcion !== undefined) datosDb.descripcion = datos.descripcion;
  if (datos.codigo !== undefined) datosDb.codigo = datos.codigo;
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

  // Traemos camposForm y bloquesTaller igual que en obtenerEvento,
  // porque el formulario de inscripción necesita esos datos para renderizarse.
  // No traemos cantidadInscriptos ni imagenUrl porque este endpoint es público
  // y no necesita esos datos para el flujo de inscripción.
  const [camposForm, bloquesTaller, portada] = await Promise.all([
    formulariosRepository.listarPorEvento(evento.id),
    talleresRepository.listarBloquesPorEvento(evento.id),
    archivosRepository.buscarPortadaDeEvento(evento.id),
  ]);

  return {
    ...evento,
    imagenUrl: portada ? construirUrlPublica(portada.key) : null,
    camposForm,
    bloquesTaller,
  };
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
  return { disponible: !eventoExistente, eventoId: eventoExistente?.id || null };
}

/**
 * Calcula los KPIs del evento para el dashboard de administración.
 *
 * La parte más interesante es camposFormStats: como respuestas_form es un
 * JSONB en cada fila de participante (no una tabla separada), no podemos
 * hacer un GROUP BY directo en SQL. En cambio, traemos todas las respuestas
 * en memoria y las agrupamos con JavaScript.
 *
 * Esto es aceptable para el volumen esperado (hasta 15.000 inscriptos),
 * pero si en algún momento se vuelve lento, se puede migrar a una query
 * SQL con jsonb_each() de PostgreSQL que hace el grouping en la DB.
 */
async function obtenerStats(id, orgId) {
  // Verificamos pertenencia (reutilizamos la validación de obtenerEvento
  // sin traer todo el detalle — solo necesitamos saber que el evento existe
  // y es de esta org antes de hacer las queries de stats).
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

  // Traemos todo lo que necesitamos en paralelo
  const [totalInscriptos, bloques, campos, filas] = await Promise.all([
    eventosRepository.contarInscriptos(id),
    talleresRepository.listarBloquesPorEvento(id),
    formulariosRepository.listarPorEvento(id),
    eventosRepository.listarRespuestasForm(id),
  ]);

  // Calcular inscriptos por taller
  const bloquesConStats = await Promise.all(
    bloques.map(async (bloque) => ({
      id: bloque.id,
      nombre: bloque.nombre,
      cantidad_elegible: bloque.cantidad_elegible,
      es_obligatorio: bloque.es_obligatorio,
      talleres: await Promise.all(
        bloque.talleres.map(async (taller) => ({
          id: taller.id,
          nombre: taller.nombre,
          capacidad: taller.capacidad,
          inscriptos: await eventosRepository.contarInscriptosPorTaller(taller.id),
        }))
      ),
    }))
  );

  // Agrupar respuestas de campos de formulario en memoria
  // Solo mostramos stats de campos de tipo seleccion, booleano y texto —
  // fecha y numero tienen demasiada variabilidad para ser útiles agrupados.
  const TIPOS_CON_STATS = ['seleccion', 'booleano', 'texto', 'numero', 'fecha'];

  const camposFormStats = campos
    .filter((campo) => TIPOS_CON_STATS.includes(campo.tipo))
    .map((campo) => {
      // Recolectamos todos los valores no vacíos para este campo
      const valores = [];
      for (const fila of filas) {
        const respuestas = fila.respuestas_form || {};
        const valor = respuestas[campo.id];
        if (valor === undefined || valor === null || valor === '') continue;
        valores.push(valor);
      }

      const totalRespuestas = valores.length;
      let stats = {};

      switch (campo.tipo) {
        case 'seleccion':
        case 'booleano': {
          // Agrupa por valor y cuenta frecuencia, ordenado desc
          const conteo = {};
          for (const v of valores) {
            const clave = String(v);
            conteo[clave] = (conteo[clave] || 0) + 1;
          }
          stats.respuestasPopulares = Object.entries(conteo)
            .map(([valor, cantidad]) => ({ valor, cantidad }))
            .sort((a, b) => b.cantidad - a.cantidad);
          break;
        }

        case 'texto': {
          // Top 5 respuestas más frecuentes (útil si hay respuestas comunes)
          // + total de respuestas no vacías
          const conteo = {};
          for (const v of valores) {
            const clave = String(v).trim().toLowerCase();
            conteo[clave] = (conteo[clave] || 0) + 1;
          }
          stats.respuestasFrecuentes = Object.entries(conteo)
            .map(([valor, cantidad]) => ({ valor, cantidad }))
            .sort((a, b) => b.cantidad - a.cantidad)
            .slice(0, 5);
          break;
        }

        case 'numero': {
          const nums = valores.map(Number).filter((n) => !isNaN(n));
          if (nums.length > 0) {
            stats.promedio = Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
            stats.minimo = Math.min(...nums);
            stats.maximo = Math.max(...nums);
          }
          break;
        }

        case 'fecha': {
          const fechas = valores.map((v) => new Date(v)).filter((d) => !isNaN(d));
          if (fechas.length > 0) {
            stats.minimo = new Date(Math.min(...fechas)).toISOString().split('T')[0];
            stats.maximo = new Date(Math.max(...fechas)).toISOString().split('T')[0];
          }
          break;
        }
      }

      return {
        id: campo.id,
        etiqueta: campo.etiqueta,
        tipo: campo.tipo,
        totalRespuestas,
        ...stats,
      };
    });

  return {
    totalInscriptos,
    bloquesTaller: bloquesConStats,
    camposFormStats,
  };
}

module.exports = {
  crearEvento,
  listarEventos,
  obtenerEvento,
  editarEvento,
  eliminarEvento,
  buscarPorCodigoPublico,
  verificarDisponibilidadCodigo,
  obtenerStats
};