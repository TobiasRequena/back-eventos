const { v4: uuidv4 } = require('uuid');
const { db } = require('../../../config/db');
const participantesRepository = require('../repositories/participantes.repository');
const eventosRepository = require('../../eventos/repositories/eventos.repository');
const formulariosRepository = require('../../formularios/repositories/formularios.repository');

/**
 * Calcula si una persona es mayor de edad al momento de la inscripción.
 * "Mayor" = 18 años cumplidos o más al día de hoy.
 */
function calcularEsMayor(nacimiento) {
  const hoy = new Date();
  const fechaNac = new Date(nacimiento);

  let edad = hoy.getFullYear() - fechaNac.getFullYear();
  const mesActual = hoy.getMonth();
  const mesNac = fechaNac.getMonth();

  // Ajuste: si todavía no cumplió años este año, restar 1
  if (mesActual < mesNac || (mesActual === mesNac && hoy.getDate() < fechaNac.getDate())) {
    edad--;
  }

  return edad >= 18;
}

/**
 * Valida que las respuestas al formulario dinámico del evento sean correctas:
 * - Todos los campos requeridos tienen respuesta.
 * - Los campos de tipo 'seleccion' tienen un valor dentro de las opciones válidas.
 * - Los campos de tipo 'booleano' tienen un valor boolean.
 * - Los campos de tipo 'numero' tienen un valor numérico.
 *
 * Recibe los campos del evento (array de campo_form) y el objeto de respuestas
 * { [campo_form_id]: valor } que mandó el front.
 */
function validarRespuestasForm(campos, respuestas = {}) {
  const errores = [];

  for (const campo of campos) {
    const valor = respuestas[campo.id];
    const tieneValor = valor !== undefined && valor !== null && valor !== '';

    // Validar campo requerido
    if (campo.requerido && !tieneValor) {
      errores.push(`El campo "${campo.etiqueta}" es obligatorio`);
      continue; // no seguimos validando el tipo si no hay valor
    }

    // Si no tiene valor y no es requerido, lo saltamos
    if (!tieneValor) continue;

    // Validar tipo
    switch (campo.tipo) {
      case 'numero':
        if (isNaN(Number(valor))) {
          errores.push(`El campo "${campo.etiqueta}" debe ser un número`);
        }
        break;
      case 'booleano':
        if (typeof valor !== 'boolean') {
          errores.push(`El campo "${campo.etiqueta}" debe ser verdadero o falso`);
        }
        break;
      case 'seleccion':
        const opciones = campo.opciones || [];
        if (!opciones.includes(valor)) {
          errores.push(`El campo "${campo.etiqueta}" debe ser uno de: ${opciones.join(', ')}`);
        }
        break;
      case 'fecha':
        if (isNaN(Date.parse(valor))) {
          errores.push(`El campo "${campo.etiqueta}" debe ser una fecha válida`);
        }
        break;
      // 'texto': cualquier string es válido, no hace falta validar
    }
  }

  if (errores.length > 0) {
    const error = new Error(errores.join(' | '));
    error.status = 400;
    throw error;
  }
}

/**
 * Crea un participante nuevo en un evento.
 *
 * Reglas de negocio:
 * 1. El evento debe existir y pertenecer a la organización.
 * 2. No puede haber dos participantes con el mismo DNI en el mismo evento.
 * 3. es_mayor se calcula a partir de nacimiento al momento de la inscripción.
 * 4. Las respuestas al formulario se validan contra los campos definidos en campo_form.
 * 5. qr_personal se genera automáticamente (UUID v4).
 * 6. Si el evento tiene costo, el estado_pago arranca en 'pendiente';
 *    si no tiene costo, arranca en 'no_aplica'.
 */
async function crearParticipante(orgId, datos) {
  return db.transaction(async (trx) => {
    // 1. Verificar que el evento existe
    const evento = await eventosRepository.buscarPorId(datos.eventoId, trx);
    if (!evento) {
      const error = new Error('Evento no encontrado');
      error.status = 404;
      throw error;
    }

    // Si no viene orgId (inscripción pública sin X-Org-Id), lo tomamos del evento
    const orgIdFinal = orgId ?? evento.org_id;

    // 2. Verificar DNI único en el evento
    const duplicado = await participantesRepository.buscarPorDniEnEvento(
      datos.dni,
      datos.eventoId,
      trx
    );
    if (duplicado) {
      const error = new Error('Ya existe un participante con ese DNI en este evento');
      error.status = 409;
      throw error;
    }

    // 3. Verificar email único en el evento
    const duplicadoEmail = await participantesRepository.buscarPorEmailEnEvento(
      datos.email,
      datos.eventoId,
      trx
    );
    if (duplicadoEmail) {
      const error = new Error('Ya existe un participante con ese email en este evento');
      error.status = 409;
      throw error;
    }

    // 4. Calcular mayoría de edad
    const esMayor = calcularEsMayor(datos.nacimiento);

    // 5. Validar respuestas del formulario
    const campos = await formulariosRepository.listarPorEvento(datos.eventoId);
    console.log('campos resultado:', campos);
    console.log('tipo:', typeof campos, Array.isArray(campos));
    if (campos && campos.length > 0) {
      validarRespuestasForm(campos, datos.respuestasForm ?? {});
    }

    // 6. Determinar estado de pago inicial
    const estadoPago = evento.costo > 0 ? 'pendiente' : 'no_aplica';

    // 7. Determinar estado_vinculo según rol
    let estadoVinculo = null;
    if (datos.rolGrupo === 'autoinscripto') {
      estadoVinculo = 'pendiente';
    }

    // 8. Generar QR personal único
    const qrPersonal = uuidv4();

    const participante = await participantesRepository.crear(
      {
        orgId: orgIdFinal,
        eventoId: datos.eventoId,
        grupoId: datos.grupoId,
        nombre: datos.nombre,
        apellido: datos.apellido,
        email: datos.email,
        dni: datos.dni,
        nacimiento: datos.nacimiento,
        esMayor,
        rolGrupo: datos.rolGrupo,
        estadoVinculo,
        responsableId: datos.responsableId,
        respuestasForm: datos.respuestasForm ?? {},
        estadoPago,
        qrPersonal,
      },
      trx
    );

    return participante;
  });
}

/**
 * Lista los participantes de un evento con filtros opcionales.
 * También verifica pertenencia del evento a la organización.
 */
async function listarParticipantes(eventoId, orgId, filtros = {}) {
  const evento = await eventosRepository.buscarPorId(eventoId);
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

  return participantesRepository.listarPorEvento(eventoId, filtros);
}

/**
 * Obtiene un participante por id, verificando pertenencia a la organización.
 */
async function obtenerParticipante(id, orgId) {
  const participante = await participantesRepository.buscarPorId(id);

  if (!participante) {
    const error = new Error('Participante no encontrado');
    error.status = 404;
    throw error;
  }

  if (participante.org_id !== orgId) {
    const error = new Error('No tenés permisos sobre este participante');
    error.status = 403;
    throw error;
  }

  return participante;
}

/**
 * Edita datos básicos de un participante (nombre, apellido, email, respuestas_form).
 * DNI y nacimiento no se pueden editar — son datos de identidad que no deben
 * cambiar post-inscripción (cambiar el DNI podría evadir la unicidad del evento).
 */
async function editarParticipante(id, orgId, datos) {
  await obtenerParticipante(id, orgId);

  const datosDb = {};
  if (datos.nombre !== undefined) datosDb.nombre = datos.nombre;
  if (datos.apellido !== undefined) datosDb.apellido = datos.apellido;
  if (datos.email !== undefined) datosDb.email = datos.email;
  if (datos.respuestasForm !== undefined) {
    datosDb.respuestas_form = JSON.stringify(datos.respuestasForm);
  }

  return participantesRepository.actualizar(id, datosDb);
}

/**
 * Elimina un participante del evento (baja de inscripción).
 * No elimina si el participante es responsable de un grupo con integrantes —
 * eso lo dejamos como validación futura cuando exista el módulo grupos completo.
 */
async function eliminarParticipante(id, orgId) {
  await obtenerParticipante(id, orgId);
  await participantesRepository.eliminar(id);
}

/**
 * Aprueba o rechaza el vínculo de un autoinscripto a un grupo (RN04).
 * Solo puede hacerlo el responsable del grupo — esa verificación la hace
 * el controller/middleware, no este service.
 *
 * Un rechazo NO elimina la inscripción al evento, solo desvincula del grupo
 * (estado_vinculo = 'rechazado', grupo_id queda como estaba — el participante
 * puede volver a vincularse a otro grupo después).
 */
async function actualizarEstadoVinculo(id, orgId, estado) {
  const participante = await obtenerParticipante(id, orgId);

  if (participante.rol_grupo !== 'autoinscripto') {
    const error = new Error('Solo se puede aprobar/rechazar el vínculo de participantes autoinscriptos');
    error.status = 400;
    throw error;
  }

  if (participante.estado_vinculo !== 'pendiente') {
    const error = new Error('Este participante ya fue aceptado o rechazado anteriormente');
    error.status = 409;
    throw error;
  }

  return participantesRepository.actualizar(id, { estado_vinculo: estado });
}

/**
 * Devuelve la última ubicación conocida de un participante
 * basada en su último checkin_taller (RN12.1).
 * Por ahora devuelve null — se implementa cuando construyamos acreditación.
 */
async function obtenerUltimaUbicacion(id, orgId) {
  await obtenerParticipante(id, orgId);
  // TODO: implementar cuando exista el módulo acreditación
  return null;
}

module.exports = {
  crearParticipante,
  listarParticipantes,
  obtenerParticipante,
  editarParticipante,
  eliminarParticipante,
  actualizarEstadoVinculo,
  obtenerUltimaUbicacion,
  calcularEsMayor,
};