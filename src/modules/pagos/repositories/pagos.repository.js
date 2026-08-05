const { db } = require('../../../config/db');
const { invalidar } = require('../../../utils/cache');

/**
 * Busca el tramo correspondiente a una cantidad de participantes.
 * El tramo es la fila con participantes_desde más alto que sea <= cantidad.
 */
async function buscarTramoActual(cantidad, trx = db) {
  return trx('tramo_precio_plataforma')
    .where('participantes_desde', '<=', cantidad)
    .where('activo', true)
    .orderBy('participantes_desde', 'desc')
    .first();
}

async function crearPago(datos, trx = db) {
  const [pago] = await trx('pago')
    .insert({
      org_id: datos.orgId,
      evento_id: datos.eventoId,
      tipo: 'creacion_evento',
      metodo: 'pasarela',
      monto: datos.monto,
      estado: 'pendiente',
      ref_pasarela: datos.refPasarela ?? null,
    })
    .returning('*');
  return pago;
}

async function buscarPagoPendientePorEvento(eventoId, trx = db) {
  return trx('pago')
    .where({ evento_id: eventoId, tipo: 'creacion_evento', estado: 'pendiente' })
    .first();
}

async function aprobarPago(referenceId, trx = db) {
  const [pago] = await trx('pago')
    .where({ ref_pasarela: referenceId }) // busca por referenceId
    .update({ estado: 'aprobado' })
    .returning('*');

  invalidar(`evento:${pago.evento_id}`);
  invalidar(`admin:stats:${pago.evento_id}`);
  return pago;
}

async function actualizarRefPasarela(id, refPasarela, trx = db) {
  const [pago] = await trx('pago')
    .where({ id })
    .update({ ref_pasarela: refPasarela })
    .returning('*');
  return pago;
}

async function cancelarPagosPendientes(eventoId, trx = db) {
  console.log('[pagos] intentando cancelar pagos de evento:', eventoId);
  const resultado = await trx('pago')
    .where({ evento_id: eventoId, tipo: 'creacion_evento', estado: 'pendiente' })
    .update({ estado: 'cancelado' })
    .returning('*');
  console.log('[pagos] resultado cancelacion:', resultado);
  return resultado;
}

async function listarTramos() {
  return db('tramo_precio_plataforma')
    .where({ activo: true })
    .orderBy('participantes_desde', 'asc');
}

async function listarPagosPorEvento(eventoId) {
  return db('pago')
    .where({ evento_id: eventoId, tipo: 'creacion_evento' })
    .orderBy('creado_en', 'desc');
}

module.exports = {
  buscarTramoActual,
  crearPago,
  buscarPagoPendientePorEvento,
  aprobarPago,
  actualizarRefPasarela,
  cancelarPagosPendientes,
  listarTramos,
  listarPagosPorEvento
};