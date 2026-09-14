const { db } = require('../../../config/db');

// ---------- acreditador_sesion ----------

async function crearSesion(datos, trx = db) {
  const [sesion] = await trx('acreditador_sesion')
    .insert({
      org_id: datos.orgId,
      evento_id: datos.eventoId,
      punto_acceso_id: datos.puntoAccesoId ?? null,
      nombre: datos.nombre,
      apellido: datos.apellido,
    })
    .returning('*');
  return sesion;
}

async function buscarSesionPorId(id, trx = db) {
  return trx('acreditador_sesion').where({ id }).first();
}

// ---------- checkin ----------

/**
 * Crea un checkin. El UNIQUE en participante_id garantiza que no se
 * pueda acreditar dos veces a la misma persona — si ya existe,
 * PostgreSQL tira un error 23505 que capturamos en el service.
 */
async function crearCheckin(datos, trx = db) {
  try {
    const [checkin] = await trx('checkin')
      .insert({
        org_id: datos.orgId,
        participante_id: datos.participanteId,
        acreditador_id: datos.acreditadorId,
        punto_acceso_id: datos.puntoAccesoId ?? null,
        momento: new Date(),
      })
      .returning('*');
    return checkin;
  } catch (err) {
    if (err.code === '23505') {
      const error = new Error('Este participante ya fue acreditado');
      error.status = 409;
      throw error;
    }
    throw err;
  }
}

/**
 * Verifica si un participante ya fue acreditado.
 */
async function buscarCheckinPorParticipante(participanteId, trx = db) {
  return trx('checkin').where({ participante_id: participanteId }).first();
}

/**
 * Igual que buscarCheckinPorParticipante pero para varios participantes
 * de una sola vez (evita el N+1 al resolver un grupo entero).
 * Devuelve el set de participante_id que ya tienen checkin.
 */
async function buscarCheckinsPorParticipantes(participanteIds, trx = db) {
  if (participanteIds.length === 0) return new Set();
  const checkins = await trx('checkin')
    .whereIn('participante_id', participanteIds)
    .select('participante_id');
  return new Set(checkins.map((c) => c.participante_id));
}

/**
 * Inserta varios checkins de una — usado en la acreditación grupal para
 * no hacer un INSERT por participante. Misma protección de UNIQUE que
 * crearCheckin: si alguno ya existe, PostgreSQL tira 23505.
 */
async function crearCheckins(rows, trx = db) {
  if (rows.length === 0) return [];
  try {
    return await trx('checkin')
      .insert(rows.map((datos) => ({
        org_id: datos.orgId,
        participante_id: datos.participanteId,
        acreditador_id: datos.acreditadorId,
        punto_acceso_id: datos.puntoAccesoId ?? null,
        momento: new Date(),
      })))
      .returning('*');
  } catch (err) {
    if (err.code === '23505') {
      const error = new Error('Uno o más participantes ya fueron acreditados');
      error.status = 409;
      throw error;
    }
    throw err;
  }
}

/**
 * Cuenta los acreditados de un evento — para el dashboard en tiempo real.
 */
async function contarAcreditadosPorEvento(eventoId, trx = db) {
  const [{ count }] = await trx('checkin')
    .join('participante', 'participante.id', 'checkin.participante_id')
    .where('participante.evento_id', eventoId)
    .count('checkin.id');
  return Number(count);
}

async function listarAcreditadores(eventoId, orgId) {
  return db('acreditador_sesion')
    .where({ evento_id: eventoId, org_id: orgId })
    .select('id', 'nombre', 'apellido')
    .orderBy('nombre', 'asc');
}

module.exports = {
  crearSesion,
  buscarSesionPorId,
  crearCheckin,
  crearCheckins,
  buscarCheckinPorParticipante,
  buscarCheckinsPorParticipantes,
  contarAcreditadosPorEvento,
  listarAcreditadores
};