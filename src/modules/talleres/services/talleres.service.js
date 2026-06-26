const db = require('../../../config/db').db;
const talleresRepository = require('../repositories/talleres.repository');
const eventosRepository = require('../../eventos/repositories/eventos.repository');

/**
 * Verifica que un evento exista y pertenezca a la organización activa.
 * La reusamos antes de crear/listar talleres de ese evento, igual que
 * el patrón que ya usa eventos.service para sí mismo.
 */
async function verificarEventoDeLaOrg(eventoId, orgId) {
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

  return evento;
}

/**
 * Crea un taller individual para un evento existente (fuera del flujo
 * de creación conjunta del evento).
 */
async function crearTaller(eventoId, orgId, datos) {
  await verificarEventoDeLaOrg(eventoId, orgId);
  return talleresRepository.crear(eventoId, orgId, datos);
}

/**
 * Lista los talleres de un evento.
 */
async function listarTalleres(eventoId, orgId) {
  await verificarEventoDeLaOrg(eventoId, orgId);
  return talleresRepository.listarPorEvento(eventoId);
}

/**
 * Busca un taller por id, verificando que pertenezca a la organización activa.
 */
async function obtenerTaller(id, orgId) {
  const taller = await talleresRepository.buscarPorId(id);

  if (!taller) {
    const error = new Error('Taller no encontrado');
    error.status = 404;
    throw error;
  }

  if (taller.org_id !== orgId) {
    const error = new Error('No tenés permisos sobre este taller');
    error.status = 403;
    throw error;
  }

  return taller;
}

/**
 * Edita un taller. Si se manda inicio o fin (uno solo), valida el CHECK
 * (fin > inicio) contra el valor que no se está actualizando — mismo
 * patrón que usamos en eventos.service.editarEvento.
 */
async function editarTaller(id, orgId, datos) {
  const taller = await obtenerTaller(id, orgId);

  const inicioFinal = datos.inicio ?? taller.inicio;
  const finFinal = datos.fin ?? taller.fin;

  if (new Date(finFinal) <= new Date(inicioFinal)) {
    const error = new Error('fin debe ser posterior a inicio');
    error.status = 400;
    throw error;
  }

  const datosDb = {};
  if (datos.nombre !== undefined) datosDb.nombre = datos.nombre;
  if (datos.inicio !== undefined) datosDb.inicio = datos.inicio;
  if (datos.fin !== undefined) datosDb.fin = datos.fin;
  if (datos.capacidad !== undefined) datosDb.capacidad = datos.capacidad;
  if (datos.lugarId !== undefined) datosDb.lugar_id = datos.lugarId;

  return talleresRepository.actualizar(id, datosDb);
}

/**
 * Elimina un taller.
 */
async function eliminarTaller(id, orgId) {
  await obtenerTaller(id, orgId);
  await talleresRepository.eliminar(id);
}

/**
 * Lista los participantes inscriptos a un taller.
 */
async function listarInscriptos(tallerId, orgId) {
  await obtenerTaller(tallerId, orgId);
  return talleresRepository.listarInscriptos(tallerId);
}

/**
 * Asigna un participante a un taller.
 *
 * Reglas de negocio:
 * - No se puede asignar dos veces al mismo taller (UNIQUE de la tabla,
 *   pero damos un mensaje claro antes).
 * - Si el taller tiene capacidad definida, no se puede superar el cupo.
 *   (capacidad es nullable — si es null, no hay límite).
 */
async function asignarParticipante(tallerId, orgId, participanteId) {
  return db.transaction(async (trx) => {
    const taller = await talleresRepository.buscarPorId(tallerId, trx);
    if (!taller) {
      const error = new Error('Taller no encontrado');
      error.status = 404;
      throw error;
    }
    if (taller.org_id !== orgId) {
      const error = new Error('No tenés permisos sobre este taller');
      error.status = 403;
      throw error;
    }

    const inscripcionExistente = await talleresRepository.buscarInscripcion(
      participanteId,
      tallerId,
      trx
    );
    if (inscripcionExistente) {
      const error = new Error('El participante ya está inscripto a este taller');
      error.status = 409;
      throw error;
    }

    if (taller.capacidad !== null) {
      const inscriptos = await talleresRepository.contarInscriptos(tallerId, trx);
      if (inscriptos >= taller.capacidad) {
        const error = new Error('El taller ya alcanzó su capacidad máxima');
        error.status = 409;
        throw error;
      }
    }

    return talleresRepository.asignarParticipante({ participanteId, tallerId, orgId }, trx);
  });
}

/**
 * Desasigna un participante de un taller.
 */
async function desasignarParticipante(tallerId, orgId, participanteId) {
  const taller = await obtenerTaller(tallerId, orgId);

  const inscripcion = await talleresRepository.buscarInscripcion(participanteId, taller.id);
  if (!inscripcion) {
    const error = new Error('Ese participante no está inscripto a este taller');
    error.status = 404;
    throw error;
  }

  await talleresRepository.desasignarParticipante(participanteId, taller.id);
}

module.exports = {
  crearTaller,
  listarTalleres,
  obtenerTaller,
  editarTaller,
  eliminarTaller,
  listarInscriptos,
  asignarParticipante,
  desasignarParticipante,
};