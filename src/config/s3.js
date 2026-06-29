const { S3Client } = require('@aws-sdk/client-s3');

/**
 * Cliente S3 apuntando a Cloudflare R2. R2 es compatible con la API de S3,
 * así que usamos el SDK oficial de AWS pero con el endpoint de R2.
 *
 * forcePathStyle: true es necesario para R2 (y la mayoría de los proveedores
 * S3-compatible que no son AWS) — sin esto, el SDK intenta armar URLs con
 * el formato de subdominios de AWS, que R2 no usa.
 */
const s3Client = new S3Client({
  region: process.env.S3_REGION || 'auto',
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
  forcePathStyle: true,
});

module.exports = s3Client;