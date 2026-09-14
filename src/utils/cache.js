const NodeCache = require('node-cache');

// TTL default: 5 minutos. checkperiod: limpia keys expiradas cada 60 segundos.
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// Versión actual de cada scope (ej. "evento:42", "org:7"). Todas las keys
// cacheadas dentro de un scope llevan su versión adentro de la key real, así
// que invalidar un scope es simplemente bumpear el número acá — no hay que
// enumerar ni acordarse de todas las variantes de key que dependen de ese scope.
const versiones = new Map();

function versionDe(scope) {
  return versiones.get(scope) ?? 0;
}

/**
 * Obtiene un valor del caché o lo calcula y lo guarda, dentro de un scope
 * (ej. `evento:${eventoId}`, `org:${orgId}`, o 'global' si no aplica ninguno).
 * @param {string} scope - agrupa todo lo que se invalida junto
 * @param {string} key - identifica el valor dentro del scope
 * @param {Function} fn - función async que devuelve el valor si no está en caché
 * @param {number} ttl - tiempo de vida en segundos (opcional, default 300)
 */
async function getOrSet(scope, key, fn, ttl = 300) {
  const fullKey = `${scope}::v${versionDe(scope)}::${key}`;
  const cached = cache.get(fullKey);
  if (cached !== undefined) return cached;

  const valor = await fn();
  cache.set(fullKey, valor, ttl);
  return valor;
}

/**
 * Invalida uno o varios scopes completos (todo lo cacheado bajo cada uno).
 * Llamar SIEMPRE después de que el write correspondiente ya se confirmó en
 * la base (fuera de la transacción, una vez que el commit resolvió) — invalidar
 * antes deja una ventana donde una lectura concurrente puede repoblar el
 * caché con el dato viejo.
 */
function invalidar(...scopes) {
  scopes.forEach((scope) => versiones.set(scope, versionDe(scope) + 1));
}

module.exports = { getOrSet, invalidar };
