// Chequeo rápido de la migración de respuestas al renombrar opciones.
// Uso: node scripts/check_renombrar_opciones.js
const assert = require('assert');
const { aplicarRenombres, aSeleccionSimple } = require('../src/modules/formularios/services/formularios.service');

const mapa = new Map([['S', 'Chico'], ['M', 'L'], ['L', 'M']]);

assert.strictEqual(aplicarRenombres('S', mapa), 'Chico');
assert.strictEqual(aplicarRenombres('XL', mapa), 'XL');
assert.deepStrictEqual(aplicarRenombres(['S', 'XL'], mapa), ['Chico', 'XL']);
// intercambio de nombres: se aplica una sola vez, no en cadena
assert.deepStrictEqual(aplicarRenombres(['M', 'L'], mapa), ['L', 'M']);
assert.strictEqual(aplicarRenombres(undefined, mapa), undefined);

// desactivar multiple
assert.strictEqual(aSeleccionSimple(['S']), 'S');
assert.strictEqual(aSeleccionSimple('S'), 'S');
assert.strictEqual(aSeleccionSimple(['S', 'M']), null);

console.log('ok');
process.exit(0);
