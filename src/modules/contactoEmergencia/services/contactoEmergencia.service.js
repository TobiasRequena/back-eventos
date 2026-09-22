const contactoEmergenciaRepository = require('../repositories/contactoEmergencia.repository');
const participantesRepository = require('../../participantes/repositories/participantes.repository');

async function obtenerContacto(participanteId, orgId) {
  const participante = await participantesRepository.buscarPorId(participanteId);
  if (!participante || participante.org_id !== orgId) {
    const error = new Error('No tenés permisos'); error.status = 403; throw error;
  }
  return contactoEmergenciaRepository.buscarPorParticipante(participanteId);
}

module.exports = { obtenerContacto };
