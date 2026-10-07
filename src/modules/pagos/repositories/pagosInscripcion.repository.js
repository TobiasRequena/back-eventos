const { db } = require('../../../config/db');

// Cuotas que paga el participante a la organización (pago tipo 'inscripcion').
// Una cuota está "en revisión" si está pendiente y tiene comprobante cargado.

async function crearCuotas(filas, trx = db) {
  if (filas.length === 0) return [];
  return trx('pago').insert(filas).returning('*');
}

async function buscarPorId(id, trx = db) {
  return trx('pago').where({ id, tipo: 'inscripcion' }).first();
}

async function actualizar(id, datos, trx = db) {
  const [pago] = await trx('pago').where({ id }).update(datos).returning('*');
  return pago;
}

/** Cuotas del participante, cada una con su último comprobante (si tiene). */
async function listarPorParticipante(participanteId, trx = db) {
  return trx('pago')
    .where({ 'pago.participante_id': participanteId, 'pago.tipo': 'inscripcion' })
    .select(
      'pago.*',
      trx.raw(`(
        SELECT json_build_object('id', a.id, 'key', a.key, 'nombre_original', a.nombre_original,
                                 'mime_type', a.mime_type, 'creado_en', a.creado_en)
        FROM archivo a WHERE a.pago_id = pago.id ORDER BY a.creado_en DESC LIMIT 1
      ) as comprobante`)
    )
    .orderBy('pago.numero_cuota', 'asc');
}

/**
 * Cuotas pendientes que vencen en los próximos `dias` días, sin comprobante y sin
 * recordatorio enviado, de participantes activos de eventos que no terminaron.
 */
async function listarParaRecordatorio(dias) {
  return db('pago')
    .join('participante', 'participante.id', 'pago.participante_id')
    .join('evento', 'evento.id', 'pago.evento_id')
    .where({ 'pago.tipo': 'inscripcion', 'pago.estado': 'pendiente', 'pago.recordatorio_enviado': false })
    .where('participante.activo', true)
    .whereNotNull('participante.email')
    .whereNotNull('pago.vencimiento')
    .whereRaw('pago.vencimiento BETWEEN current_date AND current_date + ?::int', [dias])
    .where('evento.fecha_fin', '>=', db.fn.now())
    .whereNotExists(db('archivo').whereRaw('archivo.pago_id = pago.id'))
    .select(
      'pago.id', 'pago.numero_cuota', 'pago.monto', 'pago.vencimiento',
      'participante.nombre', 'participante.apellido', 'participante.email',
      'evento.nombre as evento_nombre', 'evento.codigo as evento_codigo',
      'evento.alias_cobro', 'evento.cbu_cvu',
      db.raw(`(SELECT count(*)::int FROM pago p2
               WHERE p2.participante_id = pago.participante_id AND p2.tipo = 'inscripcion') as total_cuotas`)
    );
}

module.exports = {
  crearCuotas,
  buscarPorId,
  actualizar,
  listarPorParticipante,
  listarParaRecordatorio,
};
