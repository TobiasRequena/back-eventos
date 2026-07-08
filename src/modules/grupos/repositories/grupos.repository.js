const { db } = require('../../../config/db');

async function crear(datos, trx = db) {
  const [grupo] = await trx('grupo')
    .insert({
      org_id: datos.orgId,
      evento_id: datos.eventoId,
      responsable_id: datos.responsableId,
      nombre: datos.nombre,
      parroquia: datos.parroquia ?? null,
      localidad: datos.localidad ?? null,
      codigo_inv: datos.codigoInv,
      qr_inv: datos.qrInv,
      max_integrantes: datos.maxIntegrantes,
    })
    .returning('*');

  return grupo;
}

async function buscarPorId(id, trx = db) {
  return trx('grupo').where({ id }).first();
}

/**
 * Busca un grupo por su código de invitación — es la query que resuelve
 * el link del QR cuando un participante lo escanea.
 */
async function buscarPorCodigoInv(codigoInv, trx = db) {
  return trx('grupo').where({ codigo_inv: codigoInv }).first();
}

/**
 * Lista los grupos de un evento.
 */
async function listarPorEvento(eventoId) {
  return db('grupo').where({ evento_id: eventoId }).orderBy('nombre', 'asc');
}

async function actualizar(id, datos, trx = db) {
  const [grupo] = await trx('grupo').where({ id }).update(datos).returning('*');
  return grupo;
}

async function eliminar(id, trx = db) {
  return trx('grupo').where({ id }).del();
}

/**
 * Cuenta los integrantes actuales de un grupo —
 * se usa para validar el cupo (max_integrantes) antes de vincular uno más.
 * Solo cuenta los aceptados + el responsable (no los pendientes ni rechazados).
 */
async function contarIntegrantes(grupoId, trx = db) {
  const [{ count }] = await trx('participante')
    .where({ grupo_id: grupoId })
    .whereIn('rol_grupo', ['responsable', 'integrante'])
    .count('id');

  return Number(count);
}

/**
 * Lista los integrantes del grupo con todos sus campos de participante.
 */
async function listarIntegrantes(grupoId) {
  return db('participante')
    .where({ grupo_id: grupoId })
    .orderBy('creado_en', 'asc');
}

/**
 * Lista los autoinscriptos pendientes de aprobación del responsable.
 */
async function listarSolicitudes(grupoId) {
  return db('participante')
    .where({ grupo_id: grupoId, rol_grupo: 'autoinscripto', estado_vinculo: 'pendiente' })
    .orderBy('creado_en', 'asc');
}

module.exports = {
  crear,
  buscarPorId,
  buscarPorCodigoInv,
  listarPorEvento,
  actualizar,
  eliminar,
  contarIntegrantes,
  listarIntegrantes,
  listarSolicitudes,
};