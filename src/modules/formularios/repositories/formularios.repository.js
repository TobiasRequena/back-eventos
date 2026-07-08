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

async function buscarPorId(id, trx = db) {
  return trx('campo_form').where({ id }).first();
}

async function crear(eventoId, orgId, datos, trx = db) {
  const [campo] = await trx('campo_form')
    .insert({
      evento_id: eventoId,
      org_id: orgId,
      etiqueta: datos.etiqueta,
      tipo: datos.tipo,
      opciones: datos.tipo === 'seleccion' ? JSON.stringify(datos.opciones) : null,
      requerido: datos.requerido ?? false,
      orden: datos.orden,
    })
    .returning('*');

  return campo;
}

async function actualizar(id, datos, trx = db) {
  const [campo] = await trx('campo_form').where({ id }).update(datos).returning('*');
  return campo;
}

async function eliminar(id, trx = db) {
  return trx('campo_form').where({ id }).del();
}

/**
 * Reordena varios campos en una sola operación.
 * Recibe un array de { id, orden } y actualiza cada uno.
 * Usamos Promise.all para ejecutar todos los UPDATEs en paralelo.
 */
async function reordenar(campos, trx = db) {
  return Promise.all(
    campos.map(({ id, orden }) =>
      trx('campo_form').where({ id }).update({ orden }).returning('*')
    )
  );
}

module.exports = {
  crearVarios,
  listarPorEvento,
  buscarPorId,
  crear,
  actualizar,
  eliminar,
  reordenar,
};