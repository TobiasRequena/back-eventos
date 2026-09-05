const { db } = require('../../../config/db');
const comunicacionesRepository = require('../repositories/comunicaciones.repository');
const eventosRepository = require('../../eventos/repositories/eventos.repository');
const participantesRepository = require('../../participantes/repositories/participantes.repository');
const { enviarMail } = require('../../../utils/mail');
const s3Client = require('../../../config/s3');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { construirUrlPublica } = require('../../../utils/storage');
const { v4: uuidv4 } = require('uuid');

async function verificarEventoDeLaOrg(eventoId, orgId) {
  const evento = await eventosRepository.buscarPorId(eventoId);
  if (!evento) { const error = new Error('Evento no encontrado'); error.status = 404; throw error; }
  if (evento.org_id !== orgId) { const error = new Error('No tenés permisos'); error.status = 403; throw error; }
  return evento;
}

async function obtenerDestinatarios(eventoId, destinatarios, filtros) {
  // Base: inscriptos o acreditados
  let query = db('participante')
    .where({ 'participante.evento_id': eventoId, 'participante.activo': true })
    .select('participante.id', 'participante.email', 'participante.nombre', 'participante.apellido', 'participante.respuestas_form');

  if (destinatarios === 'acreditados') {
    query = query.join('checkin', 'checkin.participante_id', 'participante.id');
  } else if (destinatarios === 'referentes') {
    query = query.where({ 'participante.rol_grupo': 'responsable' });
  }

  const participantes = await query;

  // Aplicar filtros de campos de formulario
  if (!filtros || filtros.length === 0) return participantes;

  return participantes.filter(p => {
    const respuestas = p.respuestas_form ?? {};
    return filtros.every(f => respuestas[f.campo_form_id] === f.valor);
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function templateComunicacion({ nombreEvento, asunto, mensaje }) {
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="UTF-8"></head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
      
      <h1 style="color: #1E3A5F; border-bottom: 2px solid #1E3A5F; padding-bottom: 10px;">
        ${nombreEvento}
      </h1>

      <h2 style="color: #374151; font-size: 18px;">${asunto}</h2>

      <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 20px 0; white-space: pre-wrap;">
        ${mensaje}
      </div>

      <p style="color: #6b7280; font-size: 13px; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
        Este mail fue enviado por el organizador del evento <strong>${nombreEvento}</strong> a través de Talita Encuentros.
      </p>
    </body>
    </html>
  `;
}

async function enviarComunicacion(eventoId, orgId, usuarioId, datos, archivos = []) {
  const evento = await verificarEventoDeLaOrg(eventoId, orgId);

  if (datos.destinatarios === 'referentes' && !evento.tiene_grupos) {
    const error = new Error('Este evento no tiene grupos habilitados');
    error.status = 400;
    throw error;
  }

  // Subir adjuntos a R2
  const adjuntosGuardados = [];
  for (const archivo of archivos) {
    const key = `comunicaciones/${eventoId}/${uuidv4()}_${archivo.originalname}`;
    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: archivo.buffer,
      ContentType: archivo.mimetype,
    }));
    adjuntosGuardados.push({
      key,
      url: construirUrlPublica(key),
      nombre: archivo.originalname,
      mimetype: archivo.mimetype,
    });
  }

  // Crear registro en DB
  const comunicacion = await comunicacionesRepository.crear({
    orgId,
    eventoId,
    creadoPorUsuarioId: usuarioId,
    asunto: datos.asunto,
    mensaje: datos.mensaje,
    destinatarios: datos.destinatarios,
    filtros: datos.filtros,
    adjuntos: adjuntosGuardados.length > 0 ? adjuntosGuardados : null,
  });

  // Obtener destinatarios
  const destinatarios = await obtenerDestinatarios(eventoId, datos.destinatarios, datos.filtros);

  // Enviar mails en background
  setImmediate(async () => {
    let enviados = 0;
    let errores = 0;
    const html = templateComunicacion({
      nombreEvento: evento.nombre,
      asunto: escapeHtml(datos.asunto),
      mensaje: escapeHtml(datos.mensaje),
    });

    const attachments = adjuntosGuardados.map(a => ({
      filename: a.nombre,
      path: a.url,
    }));

    for (const p of destinatarios) {
      try {
        await enviarMail({
          to: p.email,
          subject: datos.asunto,
          html,
          from: `${evento.nombre} <comunicaciones@notificaciones.talitaencuentro.com>`,
          attachments: attachments.length > 0 ? attachments : undefined,
        });
        enviados++;
      } catch (err) {
        console.error(`[comunicaciones] Error al enviar a ${p.email}:`, err.message);
        errores++;
      }
    }

    const estado = destinatarios.length === 0
      ? 'enviado'
      : errores === destinatarios.length
        ? 'error'
        : 'enviado';

    await comunicacionesRepository.actualizar(comunicacion.id, {
      total_enviados: enviados,
      estado,
    });
  });

  return {
    comunicacionId: comunicacion.id,
    totalDestinatarios: destinatarios.length,
    estado: 'enviando',
  };
}

async function listarComunicaciones(eventoId, orgId) {
  await verificarEventoDeLaOrg(eventoId, orgId);
  return comunicacionesRepository.listarPorEvento(eventoId);
}

module.exports = { enviarComunicacion, listarComunicaciones };