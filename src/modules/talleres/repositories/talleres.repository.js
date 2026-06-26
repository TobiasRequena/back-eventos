const { db } = require('../../../config/db');

/**
 * Inserta varios talleres de una sola vez (bulk insert), asociados a un evento.
 * Se usa tanto desde eventos.service (al crear el evento con talleres incluidos)
 * como podría usarse para cargas masivas en el futuro.
 */
async function crearVarios(eventoId, orgId, talleres, trx = db) {
  if (!talleres || talleres.length === 0) return [];

  const filas = talleres.map((t) => ({
    evento_id: eventoId,
    org_id: orgId,
    lugar_id: t.lugarId ?? null,
    nombre: t.nombre,
    inicio: t.inicio,
    fin: t.fin,
    capacidad: t.capacidad ?? null,
  }));

  return trx('taller').insert(filas).returning('*');
}

/**
 * Inserta un solo taller (POST /eventos/:eventoId/talleres standalone).
 */
async function crear(eventoId, orgId, datos, trx = db) {
  const [taller] = await trx('taller')
    .insert({
      evento_id: eventoId,
      org_id: orgId,
      lugar_id: datos.lugarId ?? null,
      nombre: datos.nombre,
      inicio: datos.inicio,
      fin: datos.fin,
      capacidad: datos.capacidad ?? null,
    })
    .returning('*');

  return taller;
}

/**
 * Lista los talleres de un evento.
 */
async function listarPorEvento(eventoId) {
  return db('taller').where({ evento_id: eventoId }).orderBy('inicio', 'asc');
}

/**
 * Busca un taller por id. No filtra por org_id — esa verificación de
 * pertenencia la hace el service, igual que en eventos.
 */
async function buscarPorId(id, trx = db) {
  return trx('taller').where({ id }).first();
}

async function actualizar(id, datos, trx = db) {
  const [taller] = await trx('taller').where({ id }).update(datos).returning('*');
  return taller;
}

async function eliminar(id, trx = db) {
  return trx('taller').where({ id }).del();
}

/**
 * Cuenta cuántos participantes ya están asignados a un taller —
 * se usa para validar el cupo (capacidad) antes de asignar uno más.
 */
async function contarInscriptos(tallerId, trx = db) {
  const [{ count }] = await trx('participante_taller').where({ taller_id: tallerId }).count('id');
  return Number(count);
}

/**
 * Lista los participantes inscriptos a un taller.
 */
async function listarInscriptos(tallerId) {
  return db('participante_taller')
    .join('participante', 'participante.id', 'participante_taller.participante_id')
    .where('participante_taller.taller_id', tallerId)
    .select(
      'participante.id',
      'participante.nombre',
      'participante.apellido',
      'participante_taller.id as inscripcion_id'
    );
}

/**
 * Verifica si un participante ya está inscripto a un taller puntual
 * (UNIQUE participante_id, taller_id) — usamos esto para dar un mensaje
 * claro en vez del error crudo de PostgreSQL.
 */
async function buscarInscripcion(participanteId, tallerId, trx = db) {
  return trx('participante_taller')
    .where({ participante_id: participanteId, taller_id: tallerId })
    .first();
}

async function asignarParticipante({ participanteId, tallerId, orgId }, trx = db) {
  const [inscripcion] = await trx('participante_taller')
    .insert({ participante_id: participanteId, taller_id: tallerId, org_id: orgId })
    .returning('*');

  return inscripcion;
}

async function desasignarParticipante(participanteId, tallerId, trx = db) {
  return trx('participante_taller').where({ participante_id: participanteId, taller_id: tallerId }).del();
}

module.exports = {
  crearVarios,
  crear,
  listarPorEvento,
  buscarPorId,
  actualizar,
  eliminar,
  contarInscriptos,
  listarInscriptos,
  buscarInscripcion,
  asignarParticipante,
  desasignarParticipante,
};