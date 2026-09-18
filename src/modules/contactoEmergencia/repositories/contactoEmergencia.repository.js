const { db } = require('../../../config/db');

async function crear(datos, trx = db) {
  const [contacto] = await trx('contacto_emergencia').insert(datos).returning('*');
  return contacto;
}

async function buscarPorParticipante(participanteId, trx = db) {
  return trx('contacto_emergencia').where({ participante_id: participanteId }).first();
}

module.exports = { crear, buscarPorParticipante };
