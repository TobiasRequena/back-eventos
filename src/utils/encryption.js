const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'utf8');
const IV_LENGTH = 16;

function encriptar(texto) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encriptado = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${encriptado.toString('hex')}`;
}

function desencriptar(textoEncriptado) {
  const [ivHex, encriptadoHex] = textoEncriptado.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const encriptado = Buffer.from(encriptadoHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  const desencriptado = Buffer.concat([decipher.update(encriptado), decipher.final()]);
  return desencriptado.toString('utf8');
}

/**
 * Hash unidireccional SHA-256 del DNI — solo para búsquedas de unicidad.
 * No se puede revertir, pero dos DNIs iguales siempre dan el mismo hash.
 */
function hashDni(dni) {
  return crypto.createHash('sha256').update(dni.trim().toLowerCase()).digest('hex');
}

module.exports = { encriptar, desencriptar, hashDni };