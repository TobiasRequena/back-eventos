const NodeCache = require('node-cache');

// TTL default: 5 minutos
// checkperiod: limpia keys expiradas cada 60 segundos
const cache = new NodeCache({ stdTTL: 900, checkperiod: 60 });

/**
 * Obtiene un valor del caché o lo calcula y lo guarda.
 * @param {string} key - clave del caché
 * @param {Function} fn - función async que devuelve el valor si no está en caché
 * @param {number} ttl - tiempo de vida en segundos (opcional, default 300)
 */
async function getOrSet(key, fn, ttl = 300) {
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const valor = await fn();
  cache.set(key, valor, ttl);
  return valor;
}

/**
 * Invalida una o varias keys del caché.
 */
function invalidar(...keys) {
  cache.del(keys);
}

/**
 * Invalida todas las keys que empiecen con un prefijo.
 * Útil para invalidar todo lo relacionado a un evento, org, etc.
 */
function invalidarPorPrefijo(prefijo) {
  const keys = cache.keys().filter(k => k.startsWith(prefijo));
  if (keys.length > 0) cache.del(keys);
}

module.exports = { getOrSet, invalidar, invalidarPorPrefijo };