const { db } = require('../../../config/db');

async function crear(datos, trx = db) {
  const [comunicacion] = await trx('comunicacion').insert({
    org_id: datos.orgId,
    evento_id: datos.eventoId,
    creado_por_usuario_id: datos.creadoPorUsuarioId,
    asunto: datos.asunto,
    mensaje: datos.mensaje,
    destinatarios: datos.destinatarios,
    filtros: datos.filtros ? JSON.stringify(datos.filtros) : null,
    adjuntos: datos.adjuntos ? JSON.stringify(datos.adjuntos) : null,
    total_enviados: 0,
    estado: 'enviando',
  }).returning('*');
  return comunicacion;
}

async function actualizar(id, datos, trx = db) {
  const [comunicacion] = await trx('comunicacion')
    .where({ id })
    .update(datos)
    .returning('*');
  return comunicacion;
}

async function listarPorEvento(eventoId) {
  return db('comunicacion')
    .where({ evento_id: eventoId })
    .orderBy('creado_en', 'desc');
}

async function buscarPorId(id) {
  return db('comunicacion').where({ id }).first();
}

module.exports = { crear, actualizar, listarPorEvento, buscarPorId };