const { v4: uuidv4 } = require('uuid');
const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const sharp = require('sharp');

const s3Client = require('../../../config/s3');
const archivosRepository = require('../repositories/archivos.repository');
const eventosRepository = require('../../eventos/repositories/eventos.repository');
const { construirUrlPublica } = require('../../../utils/storage');
const { invalidar } = require('../../../utils/cache');

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
 * Valida, optimiza a WebP y sube una imagen a R2 con la key indicada.
 * La usan la galería de la landing y el logo de la organización.
 * Devuelve el tamaño final en bytes.
 */
async function subirImagen(file, key) {
  if (!TIPOS_MIME_PERMITIDOS_IMAGEN.includes(file.mimetype)) {
    const error = new Error('La imagen debe ser jpg, png o webp');
    error.status = 400;
    throw error;
  }
  const buffer = await optimizarImagen(file.buffer);
  await s3Client.send(
    new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, Body: buffer, ContentType: 'image/webp' })
  );
  return buffer.length;
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

  // Si es portada de evento, guardamos la anterior para borrarla recién
  // cuando la nueva ya esté subida y confirmada (si subir la nueva falla,
  // no nos quedamos sin portada).
  let portadaVieja = null;
  if (datos.contexto === 'portada_evento' && datos.eventoId) {
    portadaVieja = await archivosRepository.buscarPortadaDeEvento(datos.eventoId);
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

  if (datos.contexto === 'portada_evento') {
    if (portadaVieja) {
      await _eliminarArchivoFisico(portadaVieja);
    }
    invalidar(`evento:${datos.eventoId}`, `org:${datos.orgId}`);
  }

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

async function subirAutorizacionTemplate(file, eventoId, usuarioId) {
  console.log('[autorizacion-template] eventoId:', eventoId);
  console.log('[autorizacion-template] file:', file?.originalname, file?.mimetype);
  if (file.mimetype !== 'application/pdf') {
    const error = new Error('Solo se aceptan archivos PDF');
    error.status = 400; throw error;
  }

  const key = `autorizacion-templates/${eventoId}.pdf`;
  await s3Client.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: file.buffer,
    ContentType: 'application/pdf',
  }));

  // Guardar URL en evento
  await eventosRepository.actualizar(eventoId, {
    autorizacion_template_url: construirUrlPublica(key),
  });

  // Invalidar caché
  invalidar(`evento:${eventoId}`);

  return construirUrlPublica(key);
}

module.exports = { subirArchivo, obtenerArchivo, eliminarArchivo, subirAutorizacionTemplate, subirImagen };