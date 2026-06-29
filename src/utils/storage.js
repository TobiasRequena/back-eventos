/**
 * Construye la URL pública de un archivo en el bucket, a partir de su key.
 * Se usa desde cualquier módulo que necesite mostrar una imagen/archivo
 * guardado en R2 (archivos, eventos, y a futuro participantes con sus comprobantes).
 */
function construirUrlPublica(key) {
  if (!key) return null;
  const dominioPublico = process.env.S3_PUBLIC_URL;
  if (!dominioPublico) return null;
  return `${dominioPublico}/${key}`;
}

module.exports = { construirUrlPublica };