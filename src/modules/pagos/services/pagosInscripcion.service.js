const { db } = require('../../../config/db');
const pagosInscripcionRepository = require('../repositories/pagosInscripcion.repository');
const participantesRepository = require('../../participantes/repositories/participantes.repository');
const eventosRepository = require('../../eventos/repositories/eventos.repository');
const gruposRepository = require('../../grupos/repositories/grupos.repository');
const planesPagoRepository = require('../../planesPago/repositories/planesPago.repository');
const { calcularMontosCuotas } = require('../../planesPago/services/planesPago.service');
const { enviarMail } = require('../../../utils/mail');
const {
  templateConfirmacionInscripcion,
  templatePagoRechazado,
  templateCuotaAprobada,
  templateRecordatorioCuota,
} = require('../../../utils/mailTemplates');
const { generarCredencial } = require('../../../utils/generarCredencial');
const { desencriptar } = require('../../../utils/encryption');
const { construirUrlPublica } = require('../../../utils/storage');
const { invalidar } = require('../../../utils/cache');

const DIAS_AVISO_VENCIMIENTO = 3;

/**
 * Estado resumen del participante a partir de sus cuotas. participante.estado_pago
 * se sigue usando en filtros, acreditación y stats, así que lo mantenemos al día.
 */
function estadoResumen(cuotas) {
  if (cuotas.every((c) => c.estado === 'aprobado')) return 'aprobado';
  if (cuotas.some((c) => c.estado === 'pendiente' && c.comprobante)) return 'pendiente_aprobacion';
  if (cuotas.some((c) => c.estado === 'rechazado')) return 'rechazado';
  return 'pendiente';
}

async function recalcularEstadoParticipante(participanteId, trx = db) {
  const cuotas = await pagosInscripcionRepository.listarPorParticipante(participanteId, trx);
  if (cuotas.length === 0) return null;
  const estado = estadoResumen(cuotas);
  await participantesRepository.actualizar(participanteId, { estado_pago: estado }, trx);
  return estado;
}

/**
 * Crea las cuotas de un participante recién inscripto según el plan elegido.
 * Sin plan, es una sola cuota por el total (lo mismo que pasaba antes de los planes).
 */
async function crearCuotasInscripcion({ participante, costo, planPagoId, aprobado = false }, trx) {
  let cuotasPlan = [{}];
  let cuotaQr = null;
  if (planPagoId) {
    const plan = await planesPagoRepository.buscarConCuotas(planPagoId, trx);
    if (!plan || plan.evento_id !== participante.evento_id) {
      const error = new Error('El plan de pago elegido no es válido para este evento');
      error.status = 400; throw error;
    }
    cuotasPlan = plan.cuotas;
    cuotaQr = plan.cuota_qr;
  }

  const montos = calcularMontosCuotas(costo, cuotasPlan);
  if (!montos) {
    const error = new Error('El plan de pago elegido no está disponible para tu costo de inscripción');
    error.status = 400; throw error;
  }

  return pagosInscripcionRepository.crearCuotas(
    montos.map((monto, i) => ({
      org_id: participante.org_id,
      evento_id: participante.evento_id,
      participante_id: participante.id,
      tipo: 'inscripcion',
      metodo: 'transferencia',
      monto,
      estado: aprobado ? 'aprobado' : 'pendiente',
      numero_cuota: i + 1,
      vencimiento: cuotasPlan[i].vencimiento ?? null,
      envia_qr: cuotaQr === i + 1,
    })),
    trx
  );
}

async function enviarCredencial(participante, evento) {
  const dniLegible = desencriptar(participante.dni);
  const credencialBuffer = await generarCredencial({
    qrPersonal: participante.qr_personal,
    nombreEvento: evento.nombre,
    nombreParticipante: `${participante.nombre} ${participante.apellido}`,
    dni: dniLegible,
    esReferente: participante.rol_grupo === 'responsable',
  });
  const grupo = participante.grupo_id ? await gruposRepository.buscarPorId(participante.grupo_id) : null;
  const { subject, html } = templateConfirmacionInscripcion({
    participante: { ...participante, dni: dniLegible },
    evento,
    grupo,
  });
  return enviarMail({
    to: participante.email,
    subject,
    html,
    attachments: [{
      filename: `credencial_${dniLegible}.png`,
      content: credencialBuffer,
      contentType: 'image/png',
    }],
  });
}

async function notificarRevision(participanteId, pago, estado) {
  const participante = await participantesRepository.buscarPorId(participanteId);
  if (!participante?.email) return;
  const evento = await eventosRepository.buscarPorId(participante.evento_id);

  if (estado === 'rechazado') {
    const { subject, html } = templatePagoRechazado({ participante, evento });
    return enviarMail({ to: participante.email, subject, html });
  }

  const cuotas = await pagosInscripcionRepository.listarPorParticipante(participanteId);
  const aprobadas = cuotas.filter((c) => c.estado === 'aprobado');
  const completo = aprobadas.length === cuotas.length;
  // La credencial sale con la cuota marcada en el plan (envia_qr) o, si el plan
  // no marca ninguna, cuando se completa el pago.
  const tocaCredencial = pago.envia_qr || (completo && !cuotas.some((c) => c.envia_qr));

  if (tocaCredencial) return enviarCredencial(participante, evento);

  const saldo = cuotas.filter((c) => c.estado !== 'aprobado').reduce((s, c) => s + Number(c.monto), 0);
  const { subject, html } = templateCuotaAprobada({
    participante, evento, numero: pago.numero_cuota, total: cuotas.length, saldo,
  });
  return enviarMail({ to: participante.email, subject, html });
}

/** Aprueba o rechaza una cuota (lo hace el Admin desde el panel). */
async function revisarCuota(pagoId, orgId, usuarioId, estado) {
  const pago = await pagosInscripcionRepository.buscarPorId(pagoId);
  if (!pago || pago.org_id !== orgId) {
    const error = new Error('Cuota no encontrada'); error.status = 404; throw error;
  }
  if (pago.estado === estado) return { ok: true, estado };

  const estadoParticipante = await db.transaction(async (trx) => {
    await pagosInscripcionRepository.actualizar(
      pagoId,
      { estado, revisado_por: usuarioId ?? null, revisado_en: db.fn.now() },
      trx
    );
    return recalcularEstadoParticipante(pago.participante_id, trx);
  });
  invalidar(`evento:${pago.evento_id}`);

  notificarRevision(pago.participante_id, pago, estado).catch((err) => {
    console.error('[mail] Error al notificar revisión de cuota:', err.message);
  });

  return { ok: true, estado, estadoPago: estadoParticipante };
}

/**
 * Atajo para PATCH /participantes/:id/estado-pago: aplica la revisión a la
 * cuota que corresponde (primero la que tiene comprobante en revisión).
 */
async function revisarProximaCuota(participanteId, orgId, usuarioId, estado) {
  const cuotas = await pagosInscripcionRepository.listarPorParticipante(participanteId);
  const objetivo =
    cuotas.find((c) => c.estado === 'pendiente' && c.comprobante) ??
    cuotas.find((c) => c.estado !== 'aprobado' && c.estado !== estado);
  if (!objetivo) return { ok: true, estadoPago: estadoResumen(cuotas) };
  return revisarCuota(objetivo.id, orgId, usuarioId, estado);
}

/**
 * Cuota a la que se liga un comprobante nuevo: la pedida (si es de ese participante)
 * o la primera que no esté aprobada.
 */
async function resolverCuotaParaComprobante(participanteId, pagoId) {
  const cuotas = await pagosInscripcionRepository.listarPorParticipante(participanteId);
  const cuota = pagoId
    ? cuotas.find((c) => c.id === pagoId)
    : cuotas.find((c) => c.estado !== 'aprobado');
  if (!cuota) {
    const error = new Error(pagoId ? 'La cuota no corresponde a este participante' : 'No hay cuotas pendientes de pago');
    error.status = 400; throw error;
  }
  if (cuota.estado === 'aprobado') {
    const error = new Error('Esa cuota ya está aprobada'); error.status = 400; throw error;
  }
  return cuota;
}

/** Después de subir un comprobante: la cuota vuelve a revisión y se recalcula el participante. */
async function registrarComprobante(cuota) {
  await db.transaction(async (trx) => {
    if (cuota.estado === 'rechazado') {
      await pagosInscripcionRepository.actualizar(cuota.id, { estado: 'pendiente' }, trx);
    }
    await recalcularEstadoParticipante(cuota.participante_id, trx);
  });
  invalidar(`evento:${cuota.evento_id}`);
}

function serializarCuota(c, { conUrl }) {
  return {
    id: c.id,
    numero: c.numero_cuota,
    monto: c.monto,
    vencimiento: c.vencimiento,
    estado: c.estado === 'pendiente' && c.comprobante ? 'en_revision' : c.estado,
    revisadoEn: c.revisado_en,
    comprobante: c.comprobante
      ? {
        subidoEn: c.comprobante.creado_en,
        ...(conUrl && {
          id: c.comprobante.id,
          url: construirUrlPublica(c.comprobante.key),
          nombreOriginal: c.comprobante.nombre_original,
          mimeType: c.comprobante.mime_type,
        }),
      }
      : null,
  };
}

/** Para el Admin: incluye la URL de cada comprobante. */
async function listarCuotasAdmin(participanteId) {
  const cuotas = await pagosInscripcionRepository.listarPorParticipante(participanteId);
  return cuotas.map((c) => serializarCuota(c, { conUrl: true }));
}

/** Para la página pública de comprobantes: sin URLs (el comprobante muestra datos bancarios). */
async function listarCuotasPublico(participanteId) {
  const cuotas = await pagosInscripcionRepository.listarPorParticipante(participanteId);
  return cuotas.map((c) => serializarCuota(c, { conUrl: false }));
}

// ponytail: un solo aviso por cuota, N días antes del vencimiento; sin avisos de cuota vencida
async function enviarRecordatoriosCuotas() {
  const cuotas = await pagosInscripcionRepository.listarParaRecordatorio(DIAS_AVISO_VENCIMIENTO);
  let enviados = 0;
  for (const cuota of cuotas) {
    const { subject, html } = templateRecordatorioCuota({
      participante: cuota,
      evento: { nombre: cuota.evento_nombre, alias_cobro: cuota.alias_cobro, cbu_cvu: cuota.cbu_cvu },
      cuota,
      total: cuota.total_cuotas,
      link: `${process.env.FRONTEND_URL}/comprobantepago/${cuota.evento_codigo}`,
    });
    const resultado = await enviarMail({ to: cuota.email, subject, html });
    if (resultado?.ok) {
      await pagosInscripcionRepository.actualizar(cuota.id, { recordatorio_enviado: true });
      enviados++;
    }
  }
  return enviados;
}

module.exports = {
  estadoResumen,
  recalcularEstadoParticipante,
  crearCuotasInscripcion,
  enviarCredencial,
  revisarCuota,
  revisarProximaCuota,
  resolverCuotaParaComprobante,
  registrarComprobante,
  listarCuotasAdmin,
  listarCuotasPublico,
  enviarRecordatoriosCuotas,
};
