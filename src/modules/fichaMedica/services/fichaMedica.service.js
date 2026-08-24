const fichaMedicaRepository = require('../repositories/fichaMedica.repository');
const participantesRepository = require('../../participantes/repositories/participantes.repository');
const eventosRepository = require('../../eventos/repositories/eventos.repository');

async function obtenerFicha(participanteId, orgId) {
  const participante = await participantesRepository.buscarPorId(participanteId);
  if (!participante || participante.org_id !== orgId) {
    const error = new Error('No tenés permisos'); error.status = 403; throw error;
  }
  return fichaMedicaRepository.buscarPorParticipante(participanteId);
}

async function guardarFicha(participanteId, orgId, datos) {
  const participante = await participantesRepository.buscarPorId(participanteId);
  if (!participante || participante.org_id !== orgId) {
    const error = new Error('No tenés permisos'); error.status = 403; throw error;
  }

  const [ficha] = await fichaMedicaRepository.upsert({
    org_id: participante.org_id,
    evento_id: participante.evento_id,
    participante_id: participanteId,
    obra_social: datos.obra_social ?? null,
    tipo_sangre: datos.tipo_sangre || null,
    tiene_diabetes: datos.tiene_diabetes ?? false,
    tiene_asma: datos.tiene_asma ?? false,
    tiene_epilepsia: datos.tiene_epilepsia ?? false,
    tiene_cardiopatia: datos.tiene_cardiopatia ?? false,
    otras_condiciones: datos.otras_condiciones ?? null,
    alergias: datos.alergias ?? null,
    restricciones_alimentarias: datos.restricciones_alimentarias ?? null,
    medicacion: datos.medicacion ? JSON.stringify(datos.medicacion) : null,
    tiene_discapacidad: datos.tiene_discapacidad ?? false,
    adaptaciones: datos.adaptaciones ? JSON.stringify(datos.adaptaciones) : null,
    recomendaciones: datos.recomendaciones ?? null,
  });

  return ficha;
}

module.exports = { obtenerFicha, guardarFicha };