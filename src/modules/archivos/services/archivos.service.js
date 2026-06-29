const { v4: uuidv4 } = require('uuid');
const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const s3Client = require('../../../config/s3');
const archivosRepository = require('../repositories/archivos.repository');
const { construirUrlPublica } = require('../../../utils/storage');

const TIPOS_MIME_PERMITIDOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'];
const TIPOS_MIME_PERMITIDOS_COMPROBANTE = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const TAMANO_MAXIMO_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Sube un archivo a Cloudflare R2 y guarda su registro en la tabla `archivo`.
 *
 * @param {Buffer} buffer - contenido del archivo (lo provee multer en memoria)
 * @param {Object} metadata - mimetype, originalname, size (de multer)
 * @param {Object} datos - contexto, eventoId, participanteId, usuarioId (quién sube)
 */
async function subirArchivo(buffer, metadata, datos) {
  // Validaciones básicas — por ahora solo para imágenes (portada de evento).
  // Cuando construyamos el flujo de comprobantes de pago, vamos a necesitar
  // permitir también PDF, así que esta lista de tipos permitidos va a
  // depender del contexto en el futuro.
  if (datos.contexto === 'portada_evento') {
    if (!TIPOS_MIME_PERMITIDOS_IMAGEN.includes(metadata.mimetype)) {
      const error = new Error('La portada debe ser una imagen (jpg, png o webp)');
      error.status = 400;
      throw error;
    }
  }

  if (datos.contexto === 'comprobante_pago') {
    if (!TIPOS_MIME_PERMITIDOS_COMPROBANTE.includes(metadata.mimetype)) {
      const error = new Error('El comprobante debe ser una imagen (jpg, png, webp) o un PDF');
      error.status = 400;
      throw error;
    }
  }

  if (metadata.size > TAMANO_MAXIMO_BYTES) {
    const error = new Error('El archivo no puede superar los 5MB');
    error.status = 400;
    throw error;
  }

  if (datos.contexto === 'portada_evento' && !datos.eventoId) {
    const error = new Error('Falta eventoId para subir la portada');
    error.status = 400;
    throw error;
  }

  if (datos.contexto === 'comprobante_pago' && !datos.participanteId) {
    const error = new Error('Falta participanteId para subir el comprobante');
    error.status = 400;
    throw error;
  }

  // Generamos una key única en el bucket. Usamos una carpeta lógica por
  // contexto (no es una carpeta real en S3, es solo un prefijo en el path)
  // para mantener el bucket organizado y poder hacer limpieza/auditoría
  // más fácil si hace falta.
  const extension = metadata.originalname.split('.').pop();
  const key = `${datos.contexto}/${uuidv4()}.${extension}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: metadata.mimetype,
    })
  );

  const archivo = await archivosRepository.crear({
    orgId: datos.orgId,
    eventoId: datos.eventoId,
    participanteId: datos.participanteId,
    subidoPorUsuarioId: datos.usuarioId,
    key,
    nombreOriginal: metadata.originalname,
    mimeType: metadata.mimetype,
    sizeBytes: metadata.size,
  });

  return {
    ...archivo,
    url: construirUrlPublica(key),
  };
}

/**
 * Obtiene un archivo por id, con su URL pública ya armada.
 */
async function obtenerArchivo(id) {
  const archivo = await archivosRepository.buscarPorId(id);

  if (!archivo) {
    const error = new Error('Archivo no encontrado');
    error.status = 404;
    throw error;
  }

  return { ...archivo, url: construirUrlPublica(archivo.key) };
}

/**
 * Elimina un archivo: lo borra de R2 y de la base de datos.
 */
async function eliminarArchivo(id) {
  const archivo = await archivosRepository.buscarPorId(id);

  if (!archivo) {
    const error = new Error('Archivo no encontrado');
    error.status = 404;
    throw error;
  }

  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: archivo.key,
    })
  );

  await archivosRepository.eliminar(id);
}

module.exports = { subirArchivo, obtenerArchivo, eliminarArchivo };