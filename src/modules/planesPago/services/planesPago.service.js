const { db } = require('../../../config/db');
const planesPagoRepository = require('../repositories/planesPago.repository');
const eventosRepository = require('../../eventos/repositories/eventos.repository');
const { invalidar } = require('../../../utils/cache');

/**
 * Monto de cada cuota de un plan para un costo dado. Cuenta en centavos para
 * no arrastrar errores de float. La última cuota es el resto.
 * Devuelve null si el plan no entra en ese costo (los montos fijos lo cubren o lo pasan).
 * Misma lógica en front-eventos/src/lib/costoEvento.js — si cambia una, cambiar la otra.
 */
function calcularMontosCuotas(costo, cuotas) {
  const total = Math.round(Number(costo) * 100);
  const montos = [];
  let acumulado = 0;
  cuotas.forEach((c, i) => {
    if (i === cuotas.length - 1) return;
    const centavos = c.porcentaje != null
      ? Math.round((total * Number(c.porcentaje)) / 100)
      : Math.round(Number(c.monto) * 100);
    montos.push(centavos);
    acumulado += centavos;
  });
  const resto = total - acumulado;
  if (resto <= 0) return null;
  return [...montos, resto].map((c) => c / 100);
}

async function reemplazarPlanes(eventoId, orgId, planes) {
  const evento = await eventosRepository.buscarPorId(eventoId);
  if (!evento) {
    const error = new Error('Evento no encontrado'); error.status = 404; throw error;
  }
  if (evento.org_id !== orgId) {
    const error = new Error('No tenés permisos sobre este evento'); error.status = 403; throw error;
  }

  const resultado = await db.transaction((trx) => planesPagoRepository.reemplazar(eventoId, orgId, planes, trx));
  invalidar(`evento:${eventoId}`);
  return resultado;
}

module.exports = { calcularMontosCuotas, reemplazarPlanes };

// Check rápido: node src/modules/planesPago/services/planesPago.service.js
if (require.main === module) {
  const assert = require('assert');
  assert.deepStrictEqual(calcularMontosCuotas(10000, [{}]), [10000]);
  assert.deepStrictEqual(calcularMontosCuotas(10000, [{ porcentaje: 50 }, { porcentaje: 30 }, {}]), [5000, 3000, 2000]);
  assert.deepStrictEqual(calcularMontosCuotas(6000, [{ porcentaje: 50 }, { porcentaje: 30 }, {}]), [3000, 1800, 1200]);
  assert.deepStrictEqual(calcularMontosCuotas(10000, [{ porcentaje: 33.33 }, { porcentaje: 33.33 }, {}]), [3333, 3333, 3334]);
  assert.deepStrictEqual(calcularMontosCuotas(10000, [{ monto: 8000 }, {}]), [8000, 2000]);
  assert.strictEqual(calcularMontosCuotas(6000, [{ monto: 8000 }, {}]), null);
  assert.strictEqual(calcularMontosCuotas(8000, [{ monto: 8000 }, {}]), null);
  assert.deepStrictEqual(calcularMontosCuotas('9999.99', [{ monto: 5000 }, { porcentaje: 10 }, {}]), [5000, 1000, 3999.99]);
  console.log('calcularMontosCuotas OK');
}
