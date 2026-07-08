const { v4: uuidv4 } = require('uuid');
const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const sharp = require('sharp');

const s3Client = require('../../../config/s3');
const archivosRepository = require('../repositories/archivos.repository');
const { construirUrlPublica } = require('../../../utils/storage');

const TIPOS_MIME_PERMITIDOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'];
const TIPOS_MIME_PERMITIDOS_COMPROBANTE = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const TAMANO_MAXIMO_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Optimiza una imagen antes de subirla a R2:
 * - Redimensiona a un máximo de 1200px de ancho (mantiene proporción)
 * - Convierte siempre a WebP (mejor compresión que jpg/png)
 * - Calidad 80 — buen balance entre calidad visual y tamaño
 *
 * Devuelve el buffer optimizado y el nuevo mimetype (siempre image/webp).
 */
async function optimizarImagen(buffer) {
  const optimizado = await sharp(buffer)
    .resize({ width: 1200, withoutEnlargement: true }) // no agranda si ya es más chica
    .webp({ quality: 80 })
    .toBuffer();

  return optimizado;
}

/**
 * Elimina un archivo de R2 y de la base de datos.
 * Función interna reutilizable — la usamos para limpiar la portada vieja
 * antes de subir una nueva.
 */
async function _eliminarArchivoFisico(archivo) {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: archivo.key,
    })
  );
  await archivosRepository.eliminar(archivo.id);
}

async function subirArchivo(buffer, metadata, datos) {
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

  // Si es portada de evento, borramos la anterior antes de subir la nueva
  if (datos.contexto === 'portada_evento' && datos.eventoId) {
    const portadaVieja = await archivosRepository.buscarPortadaDeEvento(datos.eventoId);
    if (portadaVieja) {
      await _eliminarArchivoFisico(portadaVieja);
    }
  }

  // Optimizar si es imagen (no aplicamos a PDFs)
  let bufferFinal = buffer;
  let mimeTypeFinal = metadata.mimetype;

  if (TIPOS_MIME_PERMITIDOS_IMAGEN.includes(metadata.mimetype)) {
    bufferFinal = await optimizarImagen(buffer);
    mimeTypeFinal = 'image/webp'; // siempre convertimos a webp
  }

  // Generamos la key — siempre con extensión .webp para imágenes optimizadas
  const extension = mimeTypeFinal === 'image/webp' ? 'webp' : metadata.originalname.split('.').pop();
  const key = `${datos.contexto}/${uuidv4()}.${extension}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: bufferFinal,
      ContentType: mimeTypeFinal,
    })
  );

  const archivo = await archivosRepository.crear({
    orgId: datos.orgId,
    eventoId: datos.eventoId,
    participanteId: datos.participanteId,
    subidoPorUsuarioId: datos.usuarioId,
    key,
    nombreOriginal: metadata.originalname,
    mimeType: mimeTypeFinal,
    sizeBytes: bufferFinal.length, // tamaño real post-optimización
  });

  return {
    ...archivo,
    url: construirUrlPublica(key),
  };
}

async function obtenerArchivo(id) {
  const archivo = await archivosRepository.buscarPorId(id);

  if (!archivo) {
    const error = new Error('Archivo no encontrado');
    error.status = 404;
    throw error;
  }

  return { ...archivo, url: construirUrlPublica(archivo.key) };
}

async function eliminarArchivo(id) {
  const archivo = await archivosRepository.buscarPorId(id);

  if (!archivo) {
    const error = new Error('Archivo no encontrado');
    error.status = 404;
    throw error;
  }

  await _eliminarArchivoFisico(archivo);
}

module.exports = { subirArchivo, obtenerArchivo, eliminarArchivo };