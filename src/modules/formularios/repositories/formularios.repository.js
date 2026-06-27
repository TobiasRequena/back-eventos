const { db } = require('../../../config/db');

/**
 * Inserta varios campos de formulario de una sola vez (bulk insert),
 * asociados a un evento. Se usa desde eventos.service al crear un evento
 * con camposForm incluidos.
 */
async function crearVarios(eventoId, orgId, campos, trx = db) {
  if (!campos || campos.length === 0) return [];

  const filas = campos.map((campo) => ({
    evento_id: eventoId,
    org_id: orgId,
    etiqueta: campo.etiqueta,
    tipo: campo.tipo,
    opciones: campo.tipo === 'seleccion' ? JSON.stringify(campo.opciones) : null,
    requerido: campo.requerido ?? false,
    orden: campo.orden,
  }));

  return trx('campo_form').insert(filas).returning('*');
}

/**
 * Lista los campos de formulario de un evento, ordenados según el campo `orden`.
 */
async function listarPorEvento(eventoId) {
  return db('campo_form').where({ evento_id: eventoId }).orderBy('orden', 'asc');
}

module.exports = { crearVarios, listarPorEvento };