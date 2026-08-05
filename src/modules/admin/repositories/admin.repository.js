const { db } = require('../../../config/db');

async function statsUsuarios(desde, hasta) {
  // Total acumulado hasta hoy
  const [{ total }] = await db('usuario').count('id as total');

  // Nuevos en el período
  const [{ nuevos }] = await db('usuario')
    .whereBetween('creado_en', [desde, hasta])
    .count('id as nuevos');

  const porDia = await db('usuario')
    .whereBetween('creado_en', [desde, hasta])
    .select(db.raw(`DATE_TRUNC('day', creado_en AT TIME ZONE 'America/Argentina/Buenos_Aires') as fecha`))
    .count('id as cantidad')
    .groupByRaw(`DATE_TRUNC('day', creado_en AT TIME ZONE 'America/Argentina/Buenos_Aires')`)
    .orderBy('fecha', 'asc');

  return { total: Number(total), nuevos: Number(nuevos), porDia };
}

async function statsOrganizaciones(desde, hasta) {
  const [{ total }] = await db('organizacion')
    .where('es_implicita', false)
    .count('id as total');

  const [{ nuevos }] = await db('organizacion')
    .where('es_implicita', false)
    .whereBetween('creado_en', [desde, hasta])
    .count('id as nuevos');

  const porDia = await db('organizacion')
    .where('es_implicita', false)
    .whereBetween('creado_en', [desde, hasta])
    .select(db.raw(`DATE_TRUNC('day', creado_en AT TIME ZONE 'America/Argentina/Buenos_Aires') as fecha`))
    .count('id as cantidad')
    .groupByRaw(`DATE_TRUNC('day', creado_en AT TIME ZONE 'America/Argentina/Buenos_Aires')`)
    .orderBy('fecha', 'asc');

  return { total: Number(total), nuevos: Number(nuevos), porDia };
}

async function statsEventos(desde, hasta) {
  const ahora = new Date();

  const [{ activos }] = await db('evento')
    .where('fecha_fin', '>=', ahora)
    .count('id as activos');

  const [{ finalizados }] = await db('evento')
    .where('fecha_fin', '<', ahora)
    .count('id as finalizados');

  // Nuevos en el período
  const [{ nuevos }] = await db('evento')
    .whereBetween('creado_en', [desde, hasta])
    .count('id as nuevos');

  const porDia = await db('evento')
    .whereBetween('creado_en', [desde, hasta])
    .select(db.raw(`DATE_TRUNC('day', creado_en AT TIME ZONE 'America/Argentina/Buenos_Aires') as fecha`))
    .count('id as cantidad')
    .groupByRaw(`DATE_TRUNC('day', creado_en AT TIME ZONE 'America/Argentina/Buenos_Aires')`)
    .orderBy('fecha', 'asc');

  return { activos: Number(activos), finalizados: Number(finalizados), nuevos: Number(nuevos), porDia };
}

async function statsInscriptos(desde, hasta) {
  const [{ total }] = await db('participante')
    .where('activo', true)
    .whereBetween('creado_en', [desde, hasta])
    .count('id as total');

  const porDia = await db('participante')
    .where('activo', true)
    .whereBetween('creado_en', [desde, hasta])
    .select(db.raw(`DATE_TRUNC('day', creado_en AT TIME ZONE 'America/Argentina/Buenos_Aires') as fecha`))
    .count('id as cantidad')
    .groupByRaw(`DATE_TRUNC('day', creado_en AT TIME ZONE 'America/Argentina/Buenos_Aires')`)
    .orderBy('fecha', 'asc');

  return { total: Number(total), porDia };
}

async function statsRevenue(desde, hasta) {
  const [{ total }] = await db('pago')
    .where({ tipo: 'creacion_evento', estado: 'aprobado' })
    .whereBetween('creado_en', [desde, hasta])
    .sum('monto as total');

  const porDia = await db('pago')
    .where({ tipo: 'creacion_evento', estado: 'aprobado' })
    .whereBetween('creado_en', [desde, hasta])
    .select(db.raw(`DATE_TRUNC('day', creado_en AT TIME ZONE 'America/Argentina/Buenos_Aires') as fecha`))
    .sum('monto as total')
    .groupByRaw(`DATE_TRUNC('day', creado_en AT TIME ZONE 'America/Argentina/Buenos_Aires')`)
    .orderBy('fecha', 'asc');

  return { total: Number(total ?? 0), porDia };
}

module.exports = { statsUsuarios, statsOrganizaciones, statsEventos, statsInscriptos, statsRevenue };