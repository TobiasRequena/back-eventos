const jwt = require('jsonwebtoken')
const { v4: uuidv4 } = require('uuid');
const { db } = require('../../../config/db');
const gruposRepository = require('../repositories/grupos.repository');
const eventosRepository = require('../../eventos/repositories/eventos.repository');
const participantesRepository = require('../../participantes/repositories/participantes.repository');
const { enviarMail } = require('../../../utils/mail');
const { templateInfoGrupoResponsable } = require('../../../utils/mailTemplates');
const { generarCredencial } = require('../../../utils/generarCredencial');
const QRCode = require('qrcode');
const { sanitizarParticipante } = require('../../participantes/services/participantes.service');
const { hashDni } = require('../../../utils/encryption');

/**
 * Genera el código de invitación — 8 caracteres alfanuméricos en mayúsculas,
 * legibles y fáciles de compartir verbalmente (ej. "AB3K9XZ2").
 */
function generarCodigoInv() {
  return uuidv4().replace(/-/g, '').toUpperCase().slice(0, 8);
}

/**
 * Arma la URL del QR de invitación — la que el front va a encodear
 * como imagen QR para que los participantes la escaneen.
 */
function armarUrlQr(codigoEvento, codigoInv) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  return `${frontendUrl}/inscribirse/${codigoEvento}?grupo=${codigoInv}`;
}

/**
 * Crea un grupo nuevo.
 *
 * Reglas de negocio:
 * 1. El evento debe existir y pertenecer a la organización.
 * 2. El responsable debe ser un participante existente del mismo evento,
 *    con rol_grupo = 'responsable'.
 * 3. El código de invitación se genera automáticamente y debe ser único
 *    (reintentamos si hay colisión, aunque es extremadamente improbable).
 */
async function crearGrupo(orgId, datos) {
  return db.transaction(async (trx) => {
    const evento = await eventosRepository.buscarPorId(datos.eventoId, trx);
    if (!evento) {
      const error = new Error('Evento no encontrado');
      error.status = 404;
      throw error;
    }
    if (evento.org_id !== orgId && orgId !== null) {
      const error = new Error('No tenés permisos sobre este evento');
      error.status = 403;
      throw error;
    }
    if (!evento.tiene_grupos) {
      const error = new Error('Este evento no tiene grupos habilitados');
      error.status = 400;
      throw error;
    }

    const orgIdFinal = orgId ?? evento.org_id;

    const responsable = await participantesRepository.buscarPorId(datos.responsableId, trx);
    if (!responsable) {
      const error = new Error('El responsable indicado no existe como participante');
      error.status = 404;
      throw error;
    }
    if (responsable.evento_id !== datos.eventoId) {
      const error = new Error('El responsable debe estar inscripto en el mismo evento');
      error.status = 400;
      throw error;
    }
    if (responsable.rol_grupo !== 'responsable') {
      const error = new Error('El participante indicado no tiene rol de responsable');
      error.status = 400;
      throw error;
    }

    // 3. Generar código único
    const codigoInv = generarCodigoInv();
    const qrInv = armarUrlQr(evento.codigo, codigoInv);

    // 4. Crear el grupo
    const grupo = await gruposRepository.crear(
      {
        orgId: orgIdFinal,
        eventoId: datos.eventoId,
        responsableId: datos.responsableId,
        nombre: datos.nombre,
        parroquia: datos.parroquia,
        localidad: datos.localidad,
        codigoInv,
        qrInv,
        maxIntegrantes: datos.maxIntegrantes,
      },
      trx
    );

    // 5. Actualizar el participante-responsable con el grupo_id recién creado
    // (la referencia circular: grupo.responsable_id → participante,
    //  participante.grupo_id → grupo — se resuelve en este orden)
    await participantesRepository.actualizar(
      datos.responsableId,
      { grupo_id: grupo.id },
      trx
    );

    // Generar QR de invitación del grupo como imagen adjunta
    const qrBuffer = await QRCode.toBuffer(grupo.qr_inv, {
      width: 300,
      margin: 2,
      color: { dark: '#1E3A5F', light: '#FFFFFF' },
    });

    // Generar credencial del responsable
    const credencialBuffer = await generarCredencial({
      qrPersonal: responsable.qr_personal,
      nombreEvento: evento.nombre,
      nombreParticipante: `${responsable.nombre} ${responsable.apellido}`,
      dni: responsable.dni,
    });

    const { subject, html } = templateInfoGrupoResponsable({
      responsable,
      grupo,
      evento,
    });

    enviarMail({
      to: responsable.email,
      subject,
      html,
      attachments: [
        {
          filename: `qr_invitacion_${grupo.codigo_inv}.png`,
          content: qrBuffer,
          contentType: 'image/png',
        },
        {
          filename: `credencial_responsable.png`,
          content: credencialBuffer,
          contentType: 'image/png',
        },
      ],
    }); // sin await

    return grupo;
  });
}

/**
 * Lista los grupos de un evento.
 */
async function listarGrupos(eventoId, orgId) {
  const evento = await eventosRepository.buscarPorId(eventoId);
  if (!evento) {
    const error = new Error('Evento no encontrado');
    error.status = 404;
    throw error;
  }
  if (evento.org_id !== orgId) {
    const error = new Error('No tenés permisos sobre este evento');
    error.status = 403;
    throw error;
  }

  return gruposRepository.listarPorEvento(eventoId);
}

/**
 * Obtiene un grupo por id, verificando pertenencia a la organización.
 */
async function obtenerGrupo(id, orgId) {
  const grupo = await gruposRepository.buscarPorId(id);

  if (!grupo) {
    const error = new Error('Grupo no encontrado');
    error.status = 404;
    throw error;
  }

  if (grupo.org_id !== orgId) {
    const error = new Error('No tenés permisos sobre este grupo');
    error.status = 403;
    throw error;
  }

  return grupo;
}

/**
 * Edita datos del grupo (nombre, parroquia, localidad, maxIntegrantes).
 */
async function editarGrupo(id, orgId, datos) {
  await obtenerGrupo(id, orgId);

  const datosDb = {};
  if (datos.nombre !== undefined) datosDb.nombre = datos.nombre;
  if (datos.parroquia !== undefined) datosDb.parroquia = datos.parroquia;
  if (datos.localidad !== undefined) datosDb.localidad = datos.localidad;
  if (datos.maxIntegrantes !== undefined) datosDb.max_integrantes = datos.maxIntegrantes;

  return gruposRepository.actualizar(id, datosDb);
}

/**
 * Elimina un grupo. No se puede eliminar si tiene integrantes.
 */
async function eliminarGrupo(id, orgId) {
  await obtenerGrupo(id, orgId);

  const integrantes = await gruposRepository.contarIntegrantes(id);
  if (integrantes > 0) {
    const error = new Error('No se puede eliminar un grupo que tiene integrantes');
    error.status = 409;
    throw error;
  }

  await gruposRepository.eliminar(id);
}

/**
 * Resuelve un código de invitación — devuelve el grupo y el evento asociado.
 * Endpoint público: lo usa el front cuando alguien escanea el QR o ingresa
 * el código manualmente para auto-inscribirse.
 */
async function resolverCodigoInvitacion(codigoInv) {
  const grupo = await gruposRepository.buscarPorCodigoInv(codigoInv);

  if (!grupo) {
    const error = new Error('Código de invitación inválido o expirado');
    error.status = 404;
    throw error;
  }

  // Verificar que el grupo no esté lleno
  const integrantes = await gruposRepository.contarIntegrantes(grupo.id);
  if (integrantes >= grupo.max_integrantes) {
    const error = new Error('Este grupo ya alcanzó su capacidad máxima');
    error.status = 409;
    throw error;
  }

  return grupo;
}

/**
 * Lista los integrantes del grupo con todos sus campos.
 */
async function listarIntegrantes(id, orgId, contexto = 'admin') {
  await obtenerGrupo(id, orgId);
  const integrantes = await gruposRepository.listarIntegrantes(id);
  return integrantes.map((p) => sanitizarParticipante(p, contexto));
}

/**
 * Lista los autoinscriptos pendientes de aprobación.
 */
async function listarSolicitudes(id, orgId, contexto = 'admin') {
  await obtenerGrupo(id, orgId);
  const solicitudes = await gruposRepository.listarSolicitudes(id);
  return solicitudes.map((p) => sanitizarParticipante(p, contexto));
}

/**
 * Login liviano para el referente del grupo.
 * Verifica que el DNI corresponda al responsable de ese grupo
 * y devuelve un JWT liviano con grupoId y participanteId.
 */
async function loginReferente({ dni, codigoGrupo }) {
  const grupo = await gruposRepository.buscarPorCodigoInv(codigoGrupo);
  if (!grupo) {
    const error = new Error('DNI o código de grupo incorrecto');
    error.status = 401;
    throw error;
  }

  const responsable = await participantesRepository.buscarPorId(grupo.responsable_id);
  if (!responsable) {
    const error = new Error('DNI o código de grupo incorrecto');
    error.status = 401;
    throw error;
  }

  if (responsable.dni_hash !== hashDni(dni)) {
    const error = new Error('DNI o código de grupo incorrecto');
    error.status = 401;
    throw error;
  }

  // Traer datos del evento para la cabecera del panel
  const evento = await eventosRepository.buscarPorId(grupo.evento_id);
  const { construirUrlPublica } = require('../../../utils/storage');
  const archivosRepository = require('../../archivos/repositories/archivos.repository');
  const portada = await archivosRepository.buscarPortadaDeEvento(evento.id);

  const token = jwt.sign(
    {
      tipo: 'referente',
      grupoId: grupo.id,
      participanteId: responsable.id,
      orgId: grupo.org_id,
      eventoId: grupo.evento_id,
    },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  return {
    token,
    grupo: {
      id: grupo.id,
      nombre: grupo.nombre,
      codigoInv: grupo.codigo_inv,
      maxIntegrantes: grupo.max_integrantes,
      parroquia: grupo.parroquia,
      localidad: grupo.localidad,
    },
    responsable: {
      id: responsable.id,
      nombre: responsable.nombre,
      apellido: responsable.apellido,
    },
    evento: {
      id: evento.id,
      nombre: evento.nombre,
      descripcion: evento.descripcion,
      fechaInicio: evento.fecha_inicio,
      fechaFin: evento.fecha_fin,
      codigo: evento.codigo,
      imagenUrl: construirUrlPublica(portada?.key),
    },
  };
}

module.exports = {
  crearGrupo,
  listarGrupos,
  obtenerGrupo,
  editarGrupo,
  eliminarGrupo,
  resolverCodigoInvitacion,
  listarIntegrantes,
  listarSolicitudes,
  loginReferente
};