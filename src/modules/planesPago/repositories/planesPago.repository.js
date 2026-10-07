const { db } = require('../../../config/db');

function agruparCuotas(planes, cuotas) {
  return planes.map((plan) => ({
    ...plan,
    cuotas: cuotas.filter((c) => c.plan_pago_id === plan.id),
  }));
}

async function listarPorEvento(eventoId, trx = db) {
  const planes = await trx('plan_pago').where({ evento_id: eventoId }).orderBy('orden', 'asc');
  if (planes.length === 0) return [];
  const cuotas = await trx('plan_pago_cuota')
    .whereIn('plan_pago_id', planes.map((p) => p.id))
    .orderBy('numero', 'asc');
  return agruparCuotas(planes, cuotas);
}

async function buscarConCuotas(id, trx = db) {
  const plan = await trx('plan_pago').where({ id }).first();
  if (!plan) return null;
  const cuotas = await trx('plan_pago_cuota').where({ plan_pago_id: id }).orderBy('numero', 'asc');
  return { ...plan, cuotas };
}

/**
 * Reemplaza todos los planes del evento. Se puede borrar sin miedo: cada
 * inscripto ya tiene sus cuotas copiadas en `pago` al momento de inscribirse.
 */
async function reemplazar(eventoId, orgId, planes, trx = db) {
  await trx('plan_pago').where({ evento_id: eventoId }).del();
  if (!planes || planes.length === 0) return [];

  const creados = await trx('plan_pago')
    .insert(planes.map((p, i) => ({ evento_id: eventoId, org_id: orgId, nombre: p.nombre, orden: i, cuota_qr: p.cuotaQr ?? null })))
    .returning('*');

  const filasCuotas = creados.flatMap((plan, i) =>
    planes[i].cuotas.map((c, j) => ({
      plan_pago_id: plan.id,
      numero: j + 1,
      porcentaje: c.porcentaje ?? null,
      monto: c.monto ?? null,
      vencimiento: c.vencimiento ?? null,
    }))
  );
  const cuotas = await trx('plan_pago_cuota').insert(filasCuotas).returning('*');
  return agruparCuotas(creados, cuotas);
}

module.exports = { listarPorEvento, buscarConCuotas, reemplazar };
