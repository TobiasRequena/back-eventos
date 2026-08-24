function construirUrlPublica(key) {
  if (!key) return null;
  if (typeof key !== 'string') return null;
  if (key.startsWith('http://') || key.startsWith('https://')) return key;

  const dominioPublico =
    process.env.S3_PUBLIC_URL ||
    (process.env.S3_ENDPOINT && process.env.S3_BUCKET ? `${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET}` : null);

  if (!dominioPublico) {
    return `/${key}`;
  }

  return `${dominioPublico}/${key}`;
}

module.exports = { construirUrlPublica };