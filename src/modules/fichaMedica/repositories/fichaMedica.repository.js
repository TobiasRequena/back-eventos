const { db } = require('../../../config/db');

async function crear(datos, trx = db) {
  const [ficha] = await trx('ficha_medica').insert(datos).returning('*');
  return ficha;
}

async function buscarPorParticipante(participanteId, trx = db) {
  return trx('ficha_medica').where({ participante_id: participanteId }).first();
}

async function actualizar(participanteId, datos, trx = db) {
  const [ficha] = await trx('ficha_medica')
    .where({ participante_id: participanteId })
    .update({ ...datos, actualizado_en: new Date() })
    .returning('*');
  return ficha;
}

async function upsert(datos, trx = db) {
  return trx('ficha_medica')
    .insert(datos)
    .onConflict(['participante_id', 'evento_id'])
    .merge()
    .returning('*');
}

module.exports = { crear, buscarPorParticipante, actualizar, upsert };