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
    .orderBy('participantes_desde', 'asc')
    .select(
      'id',
      'participantes_desde',
      'participantes_hasta',
      'monto_fijo',
      'precio_por_participante_desde',
      'precio_por_participante_hasta',
      'activo'
    );
}

async function listarPagosPorEvento(eventoId) {
  return db('pago')
    .where({ evento_id: eventoId, tipo: 'creacion_evento' })
    .orderBy('creado_en', 'desc');
}

async function listarEventosActivosConPago(orgId) {
  const ahora = new Date();

  const eventos = await db('evento')
    .where({ org_id: orgId })
    .where('fecha_fin', '>=', ahora)
    .orderBy('fecha_inicio', 'asc')
    .select('id', 'nombre', 'fecha_inicio', 'fecha_fin', 'participantes_facturados');

  if (!eventos.length) return [];

  // Contar inscriptos por evento
  const conteos = await db('participante')
    .whereIn('evento_id', eventos.map(e => e.id))
    .where('activo', true)
    .groupBy('evento_id')
    .select('evento_id')
    .count('id as total');

  const conteoMap = {};
  for (const c of conteos) conteoMap[c.evento_id] = Number(c.total);

  // Último pago por evento
  const pagos = await db('pago')
    .whereIn('evento_id', eventos.map(e => e.id))
    .where('tipo', 'creacion_evento')
    .whereNotIn('estado', ['cancelado'])
    .orderBy('creado_en', 'desc')
    .select('evento_id', 'estado', 'monto', 'creado_en');

  // Buscar tramo por monto para cada pago pendiente
  const tramoPorPago = {};
  for (const p of pagos) {
    if (p.estado === 'pendiente') {
      const tramo = await db('tramo_precio_plataforma')
        .where('monto_fijo', '>=', p.monto)
        .where('activo', true)
        .orderBy('monto_fijo', 'asc')
        .first();
      if (tramo) tramoPorPago[p.evento_id] = tramo.id;
    }
  }

  const pagoMap = {};
  for (const p of pagos) {
    if (!pagoMap[p.evento_id]) pagoMap[p.evento_id] = p;
  }

  return eventos.map(e => ({
    id: e.id,
    nombre: e.nombre,
    fecha_inicio: e.fecha_inicio,
    fecha_fin: e.fecha_fin,
    participantes_inscriptos: conteoMap[e.id] ?? 0,
    participantes_facturados: e.participantes_facturados ?? 0,
    estado_pago: pagoMap[e.id]?.estado ?? 'sin_cargo',
    monto_ultimo_pago: pagoMap[e.id]?.monto ?? null,
    tramo_pendiente_id: pagoMap[e.id]?.estado === 'pendiente' ? tramoPorPago[e.id] ?? null : null,
  }));
}

async function listarHistorialPagos(orgId) {
  const ahora = new Date();

  const eventos = await db('evento')
    .where({ org_id: orgId })
    .where('fecha_fin', '<', ahora)
    .orderBy('fecha_fin', 'desc')
    .select('id', 'nombre', 'fecha_fin', 'participantes_facturados');

  if (!eventos.length) return [];

  const pagos = await db('pago')
    .whereIn('evento_id', eventos.map(e => e.id))
    .where('tipo', 'creacion_evento')
    .whereNotIn('estado', ['cancelado'])
    .orderBy('creado_en', 'desc')
    .select('evento_id', 'estado', 'monto');

  const pagoMap = {};
  for (const p of pagos) {
    if (!pagoMap[p.evento_id]) pagoMap[p.evento_id] = p;
  }

  // Traer tramos para los montos totales
  const tramos = await db('tramo_precio_plataforma')
    .where('activo', true)
    .orderBy('participantes_desde', 'desc');

  const buscarTramo = (cantidad) =>
    tramos.find(t => t.participantes_desde <= cantidad) ?? null;

  return eventos.map(e => {
    const pago = pagoMap[e.id];
    const tramo = buscarTramo(e.participantes_facturados ?? 0);
    return {
      id: e.id,
      nombre: e.nombre,
      fecha_fin: e.fecha_fin,
      participantes_facturados: e.participantes_facturados ?? 0,
      tramo_alcanzado: tramo ? {
        participantes_desde: tramo.participantes_desde,
        participantes_hasta: tramo.participantes_hasta,
        monto_fijo: tramo.monto_fijo,
      } : null,
      monto_total: pago?.monto ?? null,
      estado_final: pago?.estado ?? 'sin_cargo',
    };
  });
}

module.exports = {
  buscarTramoActual,
  crearPago,
  buscarPagoPendientePorEvento,
  aprobarPago,
  actualizarRefPasarela,
  cancelarPagosPendientes,
  listarTramos,
  listarPagosPorEvento,
  listarEventosActivosConPago,
  listarHistorialPagos
};