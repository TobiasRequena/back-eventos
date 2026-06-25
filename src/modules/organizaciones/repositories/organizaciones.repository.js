const { db } = require('../../../config/db');

/**
 * Busca una organización por id. La devolvemos completa porque el service
 * necesita el campo es_implicita para decidir el flujo.
 */
async function buscarPorId(id, trx = db) {
  return trx('organizacion').where({ id }).first();
}

/**
 * Lista las organizaciones a las que pertenece un usuario, con su rol.
 * (Es básicamente la misma query que ya armamos en auth.repository para /me —
 * la repetimos acá porque cada módulo debe ser dueño de sus propias queries
 * sobre las tablas que le corresponden; auth no debería ser quien resuelve
 * "listar organizaciones de un usuario" a largo plazo).
 */
async function listarPorUsuario(usuarioId) {
  return db('usuario_organizacion')
    .join('organizacion', 'organizacion.id', 'usuario_organizacion.org_id')
    .where('usuario_organizacion.usuario_id', usuarioId)
    .select(
      'organizacion.id',
      'organizacion.nombre',
      'organizacion.es_implicita',
      'organizacion.estado_facturacion',
      'usuario_organizacion.rol'
    );
}

/**
 * Actualiza nombre y es_implicita de una organización.
 * Se usa en completarOrganizacion del service.
 */
async function actualizar(id, { nombre, esImplicita }, trx = db) {
  const [organizacion] = await trx('organizacion')
    .where({ id })
    .update({
      nombre,
      es_implicita: esImplicita,
    })
    .returning('*');

  return organizacion;
}

/**
 * Lista los miembros (usuario_organizacion) de una organización, con los
 * datos básicos del usuario (sin el hash de contraseña, obviamente).
 */
async function listarMiembros(orgId) {
  return db('usuario_organizacion')
    .join('usuario', 'usuario.id', 'usuario_organizacion.usuario_id')
    .where('usuario_organizacion.org_id', orgId)
    .select(
      'usuario.id',
      'usuario.nombre',
      'usuario.apellido',
      'usuario.email',
      'usuario_organizacion.rol'
    );
}

/**
 * Verifica si un usuario ya pertenece a una organización (UNIQUE de la tabla).
 * El service la usa para no insertar dos veces, devolviendo un error claro
 * en vez del error crudo de PostgreSQL.
 */
async function buscarVinculo(usuarioId, orgId) {
  return db('usuario_organizacion').where({ usuario_id: usuarioId, org_id: orgId }).first();
}

/**
 * Inserta el vínculo usuario_organizacion. rol 'admin' por ahora,
 * porque es el único valor que existe en el enum rol_usuario_org.
 */
async function crearVinculo({ usuarioId, orgId, rol = 'admin' }, trx = db) {
  const [vinculo] = await trx('usuario_organizacion')
    .insert({ usuario_id: usuarioId, org_id: orgId, rol })
    .returning('*');

  return vinculo;
}

/**
 * Quita un miembro de la organización (DELETE real, no soft-delete —
 * el modelo de datos no define un estado "inactivo" para usuario_organizacion).
 */
async function quitarVinculo(usuarioId, orgId) {
  return db('usuario_organizacion').where({ usuario_id: usuarioId, org_id: orgId }).del();
}

module.exports = {
  buscarPorId,
  listarPorUsuario,
  actualizar,
  listarMiembros,
  buscarVinculo,
  crearVinculo,
  quitarVinculo,
};