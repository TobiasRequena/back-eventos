const test = require('node:test');
const assert = require('node:assert');
const { mapearFechas, aLocal, aIso } = require('./asistente.service');

test('hora de Argentina <-> ISO UTC', () => {
  assert.strictEqual(aIso('2026-11-14T09:00'), '2026-11-14T12:00:00.000Z');
  assert.strictEqual(aIso('2026-11-14T22:30'), '2026-11-15T01:30:00.000Z'); // cruza de día
  assert.strictEqual(aLocal('2026-11-14T12:00:00.000Z'), '2026-11-14T09:00');
  assert.strictEqual(aIso(''), '');
  assert.strictEqual(aLocal(''), '');

  const b = { nombre: 'X', fechaInicio: '2026-11-14T09:00', fechaFin: '', seccionTalleres: [{ inicio: '2026-11-14T10:00', fin: '2026-11-14T12:00' }] };
  const iso = mapearFechas(b, aIso);
  assert.strictEqual(iso.fechaInicio, '2026-11-14T12:00:00.000Z');
  assert.strictEqual(iso.seccionTalleres[0].fin, '2026-11-14T15:00:00.000Z');
  assert.deepStrictEqual(mapearFechas(iso, aLocal), b); // ida y vuelta
  assert.deepStrictEqual(mapearFechas({}, aIso), { fechaInicio: undefined, fechaFin: undefined });
});

test('herramientas modifican solo lo que corresponde', async () => {
  const { ejecutar } = require('./asistente.service');
  const ctx = { usuario: null, solicitudEnviada: false };
  let b = { nombre: 'Viejo', costo: 0 };

  b = await ejecutar('actualizar_evento', { nombre: 'Retiro', cupoMaximo: 300, inventado: 'x' }, b, ctx);
  assert.deepStrictEqual(b, { nombre: 'Retiro', costo: 0, cupoMaximo: 300 });

  b = await ejecutar('agregar_campo_formulario', { etiqueta: 'Talle', tipo: 'seleccion', opciones: ['S'], requerido: true }, b, ctx);
  b = await ejecutar('agregar_campo_formulario', { etiqueta: 'talle', tipo: 'seleccion', opciones: ['S', 'M'], requerido: true }, b, ctx);
  assert.strictEqual(b.camposForm.length, 1); // reemplaza por etiqueta
  assert.deepStrictEqual(b.camposForm[0].opciones, ['S', 'M']);
  await assert.rejects(ejecutar('agregar_campo_formulario', { etiqueta: 'X', tipo: 'seleccion', requerido: false }, b, ctx));

  b = await ejecutar('agregar_bloque_talleres', { nombre: 'Sábado', inicio: '2026-11-14T10:00', fin: '2026-11-14T12:00', talleres: [{ nombre: 'Música' }] }, b, ctx);
  assert.strictEqual(b.tieneTalleres, true);
  assert.strictEqual(b.seccionTalleres[0].cantidadElegible, 1);
  b = await ejecutar('quitar', { que: 'taller', nombre: 'sábado' }, b, ctx);
  assert.deepStrictEqual([b.seccionTalleres, b.tieneTalleres], [[], false]);

  b = await ejecutar('definir_zonas_costo', { zonas: [{ nombre: 'Local', costo: 1000 }] }, b, ctx);
  assert.strictEqual(b.tienePrecioPorZona, true);
  await assert.rejects(ejecutar('definir_zonas_costo', { zonas: [{ nombre: 'Gratis', costo: 0 }] }, b, ctx));

  b = await ejecutar('actualizar_evento', { costo: 1000 }, { ...b, tienePrecioPorZona: false }, ctx);
  const plan = { nombre: '2 cuotas', cuotaQr: 1, cuotas: [{ tipo: 'monto', valor: 500, vencimiento: '2026-11-01' }, { tipo: 'resto', valor: 0, vencimiento: '' }] };
  b = await ejecutar('definir_planes_pago', { planes: [plan] }, b, ctx);
  assert.strictEqual(b.aceptaCuotas, true);
  assert.deepStrictEqual(b.planesPago[0], {
    nombre: '2 cuotas', cuotaQr: '1',
    cuotas: [{ tipo: 'monto', valor: 500, vencimiento: '2026-11-01' }, { tipo: 'resto', valor: '', vencimiento: '' }],
  });
  await assert.rejects(ejecutar('definir_planes_pago', { planes: [{ ...plan, cuotas: [{ tipo: 'monto', valor: 1000, vencimiento: '' }, plan.cuotas[1]] }] }, b, ctx), /suman/);
  await assert.rejects(ejecutar('definir_planes_pago', { planes: [{ ...plan, cuotas: [plan.cuotas[0], plan.cuotas[0]] }] }, b, ctx), /resto/);
  b = await ejecutar('quitar', { que: 'plan_pago', nombre: '2 CUOTAS' }, b, ctx);
  assert.deepStrictEqual([b.planesPago, b.aceptaCuotas], [[], false]);

  // Sin sesión ni email no se envía nada
  await assert.rejects(ejecutar('solicitar_funcionalidad', { titulo: 'X', detalle: 'Y' }, b, ctx), /email/);
  assert.strictEqual(ctx.solicitudEnviada, false);
});
