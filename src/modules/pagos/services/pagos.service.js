const { db } = require('../../../config/db');
const pagosRepository = require('../repositories/pagos.repository');
const eventosRepository = require('../../eventos/repositories/eventos.repository');
const participantesRepository = require('../../participantes/repositories/participantes.repository');
const gruposRepository = require('../../grupos/repositories/grupos.repository');
const { crearPaymentLink, reembolsarPago } = require('../../../config/galiopay');
const { enviarMail } = require('../../../utils/mail');
const { templatePagoPlataformaPendiente } = require('../../../utils/mailTemplates');
const { emitirAEvento } = require('../../../sockets/emitter');
const EVENTOS_WS = require('../../../sockets/events');
const { getOrSet, invalidar, invalidarPorPrefijo } = require('../../../utils/cache');

/**
 * Se llama después de crear un participante (fire and forget).
 * Verifica si el evento cruzó un tramo y genera el pago correspondiente.
 */
async function verificarYGenerarCargo(eventoId) {
  let pagoId = null;
  let adminEmail = null;
  let eventoNombre = null;
  let cantidadActual = null;
  let montoACobrar = null;
  let esUrgente = false;

  await db.transaction(async (trx) => {
    const evento = await eventosRepository.buscarPorId(eventoId, trx);
    if (!evento) return;

    cantidadActual = await participantesRepository.contarPorEvento(eventoId, trx);
    eventoNombre = evento.nombre;

    // Rango actual según inscriptos
    const rangoActual = await trx('tramo_precio_plataforma')
      .where('participantes_desde', '<=', cantidadActual)
      .where('activo', true)
      .orderBy('participantes_desde', 'desc')
      .first();

    if (!rangoActual) return;

    const umbral90 = Math.floor(rangoActual.participantes_hasta * 0.9);
    const limite100 = rangoActual.participantes_hasta;

    // No llegó al 90% → no hacer nada
    if (cantidadActual < umbral90) return;

    // Buscar próximo rango a cobrar
    const proximoRango = await trx('tramo_precio_plataforma')
      .where('participantes_desde', '>', rangoActual.participantes_hasta)
      .where('activo', true)
      .orderBy('participantes_desde', 'asc')
      .first();

    if (!proximoRango) return; // Sin próximo rango → no hay nada que cobrar

    // Verificar si ya hay un pago pendiente para este próximo rango
    // Verificar si ya hay un pago pendiente para este próximo rango
    const pagoPendiente = await pagosRepository.buscarPagoPendientePorEvento(eventoId, trx);

    if (pagoPendiente) {
      // Si superó el 100% y no notificamos urgente todavía → marcar y notificar
      if (cantidadActual > limite100 && !pagoPendiente.notificado_urgente) {
        await trx('pago')
          .where({ id: pagoPendiente.id })
          .update({ notificado_urgente: true });
        esUrgente = true;
        pagoId = pagoPendiente.id;
        montoACobrar = Number(pagoPendiente.monto);
        const admin = await db('usuario').where({ id: evento.creado_por_usuario_id }).first();
        adminEmail = admin?.email;
      }
      return;
    }

    // Calcular monto: próximo rango - lo ya pagado
    const montoYaPagado = evento.participantes_facturados > 0
      ? await trx('tramo_precio_plataforma')
        .where('participantes_desde', '<=', evento.participantes_facturados)
        .where('activo', true)
        .orderBy('participantes_desde', 'desc')
        .first()
        .then(r => Number(r?.monto_fijo ?? 0))
      : 0;

    montoACobrar = Number(proximoRango.monto_fijo) - montoYaPagado;
    if (montoACobrar <= 0) return;

    // Es urgente si superó el 100%
    esUrgente = cantidadActual > limite100;

    const pago = await pagosRepository.crearPago(
      { orgId: evento.org_id, eventoId, monto: montoACobrar },
      trx
    );
    pagoId = pago.id;

    const admin = await db('usuario').where({ id: evento.creado_por_usuario_id }).first();
    adminEmail = admin?.email;
  });

  if (!pagoId || !montoACobrar) return;

  try {
    let linkPago;

    if (esUrgente) {
      const pago = await db('pago').where({ id: pagoId }).first();
      linkPago = pago.link_pago;
    } else {
      // Nuevo pago → crear link
      const evento = await eventosRepository.buscarPorId(eventoId);
      const paymentLink = await crearPaymentLink({
        monto: montoACobrar,
        referenceId: pagoId,
        descripcion: `Talita Encuentros — ${eventoNombre} (${cantidadActual} inscriptos)`,
        sandbox: process.env.GALIOPAY_SANDBOX === 'true',
      });
      await pagosRepository.actualizarRefPasarela(pagoId, paymentLink.referenceId);
      await db('pago').where({ id: pagoId }).update({ link_pago: paymentLink.url });
      linkPago = paymentLink.url;
    }

    if (adminEmail) {
      const evento = await eventosRepository.buscarPorId(eventoId);
      const { subject, html } = templatePagoPlataformaPendiente({
        emailAdmin: adminEmail,
        evento,
        monto: montoACobrar,
        linkPago,
        cantidadParticipantes: cantidadActual,
        esUrgente,
      });
      enviarMail({ to: adminEmail, subject, html });
    }
  } catch (err) {
    console.error('[pagos] Error al procesar cargo:', err.message);
  }
}

/**
 * Webhook de GalioPay — se llama cuando un pago se aprueba.
 * Promueve todos los participantes pendiente_pago_org → confirmado
 * y les manda los mails con QR.
 */
async function procesarWebhookAprobado(refPasarela, galioPaymentId) {
  return db.transaction(async (trx) => {
    const pago = await trx('pago').where({ ref_pasarela: refPasarela }).first();

    if (!pago) {
      console.error('[webhook] No se encontró pago con ref:', refPasarela);
      return;
    }

    // Pago cancelado → reembolso automático
    if (pago.estado === 'cancelado') {
      console.log('[webhook] Pago cancelado recibido, iniciando reembolso:', refPasarela);
      try {
        await reembolsarPago(galioPaymentId);
        console.log('[webhook] Reembolso exitoso');
      } catch (err) {
        console.error('[webhook] Error al reembolsar:', err.message);
        enviarMail({
          to: process.env.SUPERADMIN_EMAIL,
          subject: '⚠️ Reembolso automático fallido — acción requerida',
          html: `
            <p>Pago de link cancelado recibido pero el reembolso falló.</p>
            <p><strong>GalioPay Payment ID:</strong> ${galioPaymentId}</p>
            <p><strong>Referencia:</strong> ${refPasarela}</p>
            <p>Ingresá al backoffice de GalioPay y reembolsá manualmente.</p>
          `,
        });
      }
      return;
    }

    // Webhook duplicado → ignorar
    if (pago.estado === 'aprobado') {
      console.log('[webhook] Webhook duplicado ignorado:', refPasarela);
      return;
    }

    // Aprobar pago y actualizar participantes_facturados
    await trx('pago').where({ id: pago.id }).update({ estado: 'aprobado' });

    // Actualizar participantes_facturados con la cantidad actual
    const cantidadActual = await participantesRepository.contarPorEvento(pago.evento_id, trx);
    await trx('evento')
      .where({ id: pago.evento_id })
      .update({ participantes_facturados: cantidadActual });

    invalidar(`evento:${pago.evento_id}`);
    invalidarPorPrefijo(`admin:stats:`);

    emitirAEvento(pago.evento_id, EVENTOS_WS.PAGO_ACTUALIZADO, {
      pagoId: pago.id,
      monto: pago.monto,
      estado: 'aprobado',
    });
  });
}

async function reenviarMailPago(eventoId, orgId) {
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

  const pagoPendiente = await pagosRepository.buscarPagoPendientePorEvento(eventoId);
  if (!pagoPendiente) {
    const error = new Error('No hay pagos pendientes para este evento');
    error.status = 404;
    throw error;
  }

  // Si tiene ref_pasarela, reconstruimos la URL del link de GalioPay
  // La URL es siempre: https://pay.galio.app/payment/{id}?proof={proofToken}
  // Pero solo tenemos el proofToken (ref_pasarela), no el id del payment link
  // Así que generamos un nuevo payment link con el mismo monto
  const admin = await db('usuario').where({ id: evento.creado_por_usuario_id }).first();
  if (!admin) {
    const error = new Error('No se encontró el admin del evento');
    error.status = 404;
    throw error;
  }

  const paymentLink = await crearPaymentLink({
    monto: Number(pagoPendiente.monto),
    referenceId: pagoPendiente.id,
    descripcion: `Talita Encuentros — ${evento.nombre} (reenvío)`,
    sandbox: process.env.GALIOPAY_SANDBOX === 'true',
  });

  await pagosRepository.actualizarRefPasarela(pagoPendiente.id, paymentLink.referenceId);
  await db('pago').where({ id: pagoPendiente.id }).update({ link_pago: paymentLink.url });

  const { subject, html } = templatePagoPlataformaPendiente({
    emailAdmin: admin.email,
    evento,
    monto: pagoPendiente.monto,
    linkPago: paymentLink.url,
    cantidadParticipantes: await participantesRepository.contarPorEvento(eventoId),
  });

  await enviarMail({ to: admin.email, subject, html });

  return { linkPago: paymentLink.url, monto: pagoPendiente.monto };
}

async function pagarTramoAdelantado(eventoId, orgId, participantesObjetivo) {
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

  // Verificar que el tramo objetivo sea mayor al actual
  const tramoObjetivo = await pagosRepository.buscarTramoActual(participantesObjetivo);
  if (!tramoObjetivo) {
    const error = new Error('No existe un tramo para esa cantidad de participantes');
    error.status = 400;
    throw error;
  }

  const tramoActual = evento.participantes_facturados > 0
    ? await pagosRepository.buscarTramoActual(evento.participantes_facturados)
    : null;

  if (tramoActual && tramoObjetivo.id === tramoActual.id) {
    const error = new Error('Ya estás en ese tramo');
    error.status = 400;
    throw error;
  }

  if (tramoActual && tramoObjetivo.participantes_desde <= tramoActual.participantes_desde) {
    const error = new Error('El tramo objetivo debe ser mayor al actual');
    error.status = 400;
    throw error;
  }

  // Cancelar pago pendiente anterior si existe
  const pagoPendiente = await pagosRepository.buscarPagoPendientePorEvento(eventoId);
  if (pagoPendiente) {
    await pagosRepository.cancelarPagosPendientes(eventoId);
  }

  // Calcular monto — total del tramo objetivo
  const costoObjetivo = tramoObjetivo.precio_por_participante * tramoObjetivo.participantes_desde;
  const costoActual = tramoActual
    ? tramoActual.precio_por_participante * tramoActual.participantes_desde
    : 0;
  const monto = Math.round(costoObjetivo - costoActual);

  if (monto <= 0) {
    const error = new Error('El monto calculado no es válido');
    error.status = 400;
    throw error;
  }

  // Crear pago
  const pago = await pagosRepository.crearPago({
    orgId,
    eventoId,
    monto,
  });

  // Actualizar participantes_facturados al tramo objetivo
  await db('evento')
    .where({ id: eventoId })
    .update({ participantes_facturados: tramoObjetivo.participantes_desde });

  // Crear payment link
  const admin = await db('usuario').where({ id: evento.creado_por_usuario_id }).first();

  const paymentLink = await crearPaymentLink({
    monto: Number(monto),
    referenceId: pago.id,
    descripcion: `Talita Encuentros — ${evento.nombre} (tramo ${tramoObjetivo.participantes_desde} participantes)`,
    sandbox: process.env.GALIOPAY_SANDBOX === 'true',
  });

  await pagosRepository.actualizarRefPasarela(pago.id, paymentLink.referenceId);
  await db('pago').where({ id: pago.id }).update({ link_pago: paymentLink.url });

  if (admin) {
    const { subject, html } = templatePagoPlataformaPendiente({
      emailAdmin: admin.email,
      evento,
      monto,
      linkPago: paymentLink.url,
      cantidadParticipantes: tramoObjetivo.participantes_desde,
    });
    enviarMail({ to: admin.email, subject, html });
  }

  return { linkPago: paymentLink.url, monto, tramo: tramoObjetivo };
}

async function listarTramos() {
  return getOrSet('tramos_precio', async () => {
    return pagosRepository.listarTramos();
  }, 3600);
}

async function listarPagosEvento(eventoId, orgId) {
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

  const pagos = await pagosRepository.listarPagosPorEvento(eventoId);

  return {
    participantesFacturados: evento.participantes_facturados,
    pagos: pagos.map((p) => ({
      id: p.id,
      monto: p.monto,
      estado: p.estado,
      creadoEn: p.creado_en,
    })),
  };
}

async function listarEventosActivos(orgId) {
  return pagosRepository.listarEventosActivosConPago(orgId);
}

async function listarHistorial(orgId) {
  return pagosRepository.listarHistorialPagos(orgId);
}

module.exports = {
  verificarYGenerarCargo,
  procesarWebhookAprobado,
  pagarTramoAdelantado,
  reenviarMailPago,
  listarTramos,
  listarPagosEvento,
  listarEventosActivos,
  listarHistorial
};