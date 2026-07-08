const { v4: uuidv4 } = require('uuid');
const { db } = require('../../../config/db');
const gruposRepository = require('../repositories/grupos.repository');
const eventosRepository = require('../../eventos/repositories/eventos.repository');
const participantesRepository = require('../../participantes/repositories/participantes.repository');

/**
 * Genera el código de invitación — 8 caracteres alfanuméricos en mayúsculas,
 * legibles y fáciles de compartir verbalmente (ej. "AB3K9XZ2").
 */
function generarCodigoInv() {
  return uuidv4().replace(/-/g, '').toUpperCase().slice(0, 8);
}

/**
 * Arma la URL del QR de invitación — la que el front va a encodear
 * como imagen QR para que los participantes la escaneen.
 */
function armarUrlQr(eventoId, codigoInv) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  return `${frontendUrl}/inscribirse/${eventoId}?grupo=${codigoInv}`;
}

/**
 * Crea un grupo nuevo.
 *
 * Reglas de negocio:
 * 1. El evento debe existir y pertenecer a la organización.
 * 2. El responsable debe ser un participante existente del mismo evento,
 *    con rol_grupo = 'responsable'.
 * 3. El código de invitación se genera automáticamente y debe ser único
 *    (reintentamos si hay colisión, aunque es extremadamente improbable).
 */
async function crearGrupo(orgId, datos) {
  return db.transaction(async (trx) => {
    // 1. Verificar evento
    const evento = await eventosRepository.buscarPorId(datos.eventoId, trx);
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
    if (!evento.tiene_grupos) {
      const error = new Error('Este evento no tiene grupos habilitados');
      error.status = 400;
      throw error;
    }

    // 2. Verificar responsable
    const responsable = await participantesRepository.buscarPorId(datos.responsableId, trx);
    if (!responsable) {
      const error = new Error('El responsable indicado no existe como participante');
      error.status = 404;
      throw error;
    }
    if (responsable.evento_id !== datos.eventoId) {
      const error = new Error('El responsable debe estar inscripto en el mismo evento');
      error.status = 400;
      throw error;
    }
    if (responsable.rol_grupo !== 'responsable') {
      const error = new Error('El participante indicado no tiene rol de responsable');
      error.status = 400;
      throw error;
    }

    // 3. Generar código único
    const codigoInv = generarCodigoInv();
    const qrInv = armarUrlQr(datos.eventoId, codigoInv);

    // 4. Crear el grupo
    const grupo = await gruposRepository.crear(
      {
        orgId,
        eventoId: datos.eventoId,
        responsableId: datos.responsableId,
        nombre: datos.nombre,
        parroquia: datos.parroquia,
        localidad: datos.localidad,
        codigoInv,
        qrInv,
        maxIntegrantes: datos.maxIntegrantes,
      },
      trx
    );

    // 5. Actualizar el participante-responsable con el grupo_id recién creado
    // (la referencia circular: grupo.responsable_id → participante,
    //  participante.grupo_id → grupo — se resuelve en este orden)
    await participantesRepository.actualizar(
      datos.responsableId,
      { grupo_id: grupo.id },
      trx
    );

    return grupo;
  });
}

/**
 * Lista los grupos de un evento.
 */
async function listarGrupos(eventoId, orgId) {
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

  return gruposRepository.listarPorEvento(eventoId);
}

/**
 * Obtiene un grupo por id, verificando pertenencia a la organización.
 */
async function obtenerGrupo(id, orgId) {
  const grupo = await gruposRepository.buscarPorId(id);

  if (!grupo) {
    const error = new Error('Grupo no encontrado');
    error.status = 404;
    throw error;
  }

  if (grupo.org_id !== orgId) {
    const error = new Error('No tenés permisos sobre este grupo');
    error.status = 403;
    throw error;
  }

  return grupo;
}

/**
 * Edita datos del grupo (nombre, parroquia, localidad, maxIntegrantes).
 */
async function editarGrupo(id, orgId, datos) {
  await obtenerGrupo(id, orgId);

  const datosDb = {};
  if (datos.nombre !== undefined) datosDb.nombre = datos.nombre;
  if (datos.parroquia !== undefined) datosDb.parroquia = datos.parroquia;
  if (datos.localidad !== undefined) datosDb.localidad = datos.localidad;
  if (datos.maxIntegrantes !== undefined) datosDb.max_integrantes = datos.maxIntegrantes;

  return gruposRepository.actualizar(id, datosDb);
}

/**
 * Elimina un grupo. No se puede eliminar si tiene integrantes.
 */
async function eliminarGrupo(id, orgId) {
  await obtenerGrupo(id, orgId);

  const integrantes = await gruposRepository.contarIntegrantes(id);
  if (integrantes > 0) {
    const error = new Error('No se puede eliminar un grupo que tiene integrantes');
    error.status = 409;
    throw error;
  }

  await gruposRepository.eliminar(id);
}

/**
 * Resuelve un código de invitación — devuelve el grupo y el evento asociado.
 * Endpoint público: lo usa el front cuando alguien escanea el QR o ingresa
 * el código manualmente para auto-inscribirse.
 */
async function resolverCodigoInvitacion(codigoInv) {
  const grupo = await gruposRepository.buscarPorCodigoInv(codigoInv);

  if (!grupo) {
    const error = new Error('Código de invitación inválido o expirado');
    error.status = 404;
    throw error;
  }

  // Verificar que el grupo no esté lleno
  const integrantes = await gruposRepository.contarIntegrantes(grupo.id);
  if (integrantes >= grupo.max_integrantes) {
    const error = new Error('Este grupo ya alcanzó su capacidad máxima');
    error.status = 409;
    throw error;
  }

  return grupo;
}

/**
 * Lista los integrantes del grupo con todos sus campos.
 */
async function listarIntegrantes(id, orgId) {
  await obtenerGrupo(id, orgId);
  return gruposRepository.listarIntegrantes(id);
}

/**
 * Lista los autoinscriptos pendientes de aprobación.
 */
async function listarSolicitudes(id, orgId) {
  await obtenerGrupo(id, orgId);
  return gruposRepository.listarSolicitudes(id);
}

module.exports = {
  crearGrupo,
  listarGrupos,
  obtenerGrupo,
  editarGrupo,
  eliminarGrupo,
  resolverCodigoInvitacion,
  listarIntegrantes,
  listarSolicitudes,
};