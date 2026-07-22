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
}

/**
 * Verifica si un participante ya fue acreditado.
 */
async function buscarCheckinPorParticipante(participanteId, trx = db) {
  return trx('checkin').where({ participante_id: participanteId }).first();
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

module.exports = {
  crearSesion,
  buscarSesionPorId,
  crearCheckin,
  buscarCheckinPorParticipante,
  contarAcreditadosPorEvento,
};