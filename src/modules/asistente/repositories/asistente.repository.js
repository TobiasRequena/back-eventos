const { db } = require('../../../config/db');

async function obtenerBorrador(usuarioId) {
  return db('borrador_evento').where({ usuario_id: usuarioId }).first('borrador', 'mensajes');
}

async function guardarBorrador(usuarioId, { borrador, mensajes }) {
  await db('borrador_evento')
    .insert({ usuario_id: usuarioId, borrador: JSON.stringify(borrador), mensajes: JSON.stringify(mensajes), actualizado_en: db.fn.now() })
    .onConflict('usuario_id')
    .merge();
}

async function borrarBorrador(usuarioId) {
  await db('borrador_evento').where({ usuario_id: usuarioId }).del();
}

module.exports = { obtenerBorrador, guardarBorrador, borrarBorrador };
