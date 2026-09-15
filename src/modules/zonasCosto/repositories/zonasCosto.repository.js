const { db } = require('../../../config/db');

async function listarPorEvento(eventoId) {
  return db('zona_costo').where({ evento_id: eventoId }).orderBy('orden', 'asc');
}

async function buscarPorId(id, trx = db) {
  return trx('zona_costo').where({ id }).first();
}

/**
 * Inserta varias zonas de costo de una sola vez (bulk insert), asociadas
 * a un evento. Se usa desde eventos.service al crear un evento con
 * zonasCosto incluidas (mismo patrón que formularios.crearVarios).
 */
async function crearVarias(eventoId, orgId, zonas, trx = db) {
  if (!zonas || zonas.length === 0) return [];

  const filas = zonas.map((zona) => ({
    evento_id: eventoId,
    org_id: orgId,
    nombre: zona.nombre,
    costo: zona.costo,
    orden: zona.orden ?? 0,
  }));

  return trx('zona_costo').insert(filas).returning('*');
}

async function crear(eventoId, orgId, datos, trx = db) {
  const [zona] = await trx('zona_costo')
    .insert({
      evento_id: eventoId,
      org_id: orgId,
      nombre: datos.nombre,
      costo: datos.costo,
      orden: datos.orden ?? 0,
    })
    .returning('*');

  return zona;
}

async function actualizar(id, datos, trx = db) {
  const [zona] = await trx('zona_costo').where({ id }).update(datos).returning('*');
  return zona;
}

async function eliminar(id, trx = db) {
  return trx('zona_costo').where({ id }).del();
}

module.exports = {
  listarPorEvento,
  buscarPorId,
  crearVarias,
  crear,
  actualizar,
  eliminar,
};
