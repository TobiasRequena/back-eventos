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
const { getOrSet, invalidar } = require('../../../utils/cache');

// Cuántos inscriptos antes del límite empiezan los avisos (uno por inscripción).
const AVISO_ANTICIPADO = 5;

/**
 * Situación del evento respecto al tramo que tiene pagado.
 * `participantes_facturados` es cualquier número dentro del tramo pagado
 * (0 = tramo gratuito); el límite real es el `participantes_hasta` de ese tramo.
 */
async function estadoPlan(evento, trx = db) {
  const tramoPagado = await pagosRepository.buscarTramoActual(evento.participantes_facturados ?? 0, trx);
  if (!tramoPagado) return null;
  const cant = await participantesRepository.contarPorEvento(evento.id, trx);
  const siguiente = await pagosRepository.buscarSiguienteTramo(tramoPagado.participantes_hasta, trx);
  return { cant, tramoPagado, cap: tramoPagado.participantes_hasta, siguiente };
}

/** Crea el payment link solo si el pago todavía no tiene uno. Devuelve la URL. */
async function asegurarLink(pago, descripcion, trx = db) {
  if (pago.link_pago) return pago.link_pago;
  const paymentLink = await crearPaymentLink({
    monto: Number(pago.monto),
    referenceId: pago.id,
    descripcion,
    sandbox: process.env.GALIOPAY_SANDBOX === 'true',
  });
  await trx('pago')
    .where({ id: pago.id })
    .update({ ref_pasarela: paymentLink.referenceId, link_pago: paymentLink.url });
  return paymentLink.url;
}

/**
 * Se llama dentro de la transacción de inscripción. Bloquea la fila del evento
 * (sin frenar los inserts de participantes) para que dos inscripciones
 * simultáneas no se cuelen por encima del límite pagado.
 */
async function verificarCapacidadInscripcion(eventoId, trx) {
  const evento = await trx('evento').where({ id: eventoId }).forNoKeyUpdate().first();
  if (!evento) return;
  const plan = await estadoPlan(evento, trx);
  // Sin siguiente tramo no hay nada más que vender → no se bloquea.
  if (!plan?.siguiente || plan.cant < plan.cap) return;

  const error = new Error(
    `Este evento alcanzó su límite de ${plan.cap} inscriptos. El organizador debe regularizar el pago de la plataforma para habilitar más inscripciones.`
  );
  error.status = 402;
  throw error;
}

/**
 * Se llama después de crear un participante (fire and forget).
 * Desde 5 inscriptos antes del límite pagado, cada inscripción manda un mail
 * al organizador con el link de pago del próximo tramo.
 */
async function verificarYGenerarCargo(eventoId) {
  let aviso = null;

  await db.transaction(async (trx) => {
    const evento = await trx('evento').where({ id: eventoId }).forNoKeyUpdate().first();
    if (!evento) return;

    const plan = await estadoPlan(evento, trx);
    if (!plan?.siguiente || plan.cant < plan.cap - AVISO_ANTICIPADO) return;

    let pago = await pagosRepository.buscarPagoPendientePorEvento(eventoId, trx);
    let creado = false;
    if (!pago) {
      const monto = Number(plan.siguiente.monto_fijo ?? 0) - Number(plan.tramoPagado.monto_fijo ?? 0);
      if (!(monto > 0)) return;
      pago = await pagosRepository.crearPago(
        { orgId: evento.org_id, eventoId, monto, tramoId: plan.siguiente.id },
        trx
      );
      creado = true;
    }

    const linkPago = await asegurarLink(
      pago,
      `Talita Encuentros — ${evento.nombre} (hasta ${plan.siguiente.participantes_hasta} inscriptos)`,
      trx
    );

    const admin = await trx('usuario').where({ id: evento.creado_por_usuario_id }).first();
    aviso = { evento, pago, linkPago, plan, adminEmail: admin?.email, creado };
  });

  if (!aviso) return;

  if (aviso.creado) invalidar(`org:${aviso.evento.org_id}`, `evento:${eventoId}`);

  if (aviso.adminEmail) {
    const { subject, html } = templatePagoPlataformaPendiente({
      evento: aviso.evento,
      monto: aviso.pago.monto,
      linkPago: aviso.linkPago,
      cantidadParticipantes: aviso.plan.cant,
      limite: aviso.plan.cap,
    });
    enviarMail({ to: aviso.adminEmail, subject, html });
  }
}

/**
 * Webhook de GalioPay — se llama cuando un pago se aprueba.
 * Promueve todos los participantes pendiente_pago_org → confirmado
 * y les manda los mails con QR.
 */
async function procesarWebhookAprobado(refPasarela, galioPaymentId) {
  let pagoAprobado = null;

  await db.transaction(async (trx) => {
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

    // El pago compra un tramo: facturados pasa a ser el inicio de ese tramo
    // (nunca baja). Pagos viejos sin tramo_id: cantidad actual, como antes.
    const evento = await trx('evento').where({ id: pago.evento_id }).first();
    const tramo = pago.tramo_id
      ? await trx('tramo_precio_plataforma').where({ id: pago.tramo_id }).first()
      : null;
    const facturados = tramo
      ? Math.max(tramo.participantes_desde, evento.participantes_facturados ?? 0)
      : await participantesRepository.contarPorEvento(pago.evento_id, trx);
    await trx('evento').where({ id: pago.evento_id }).update({ participantes_facturados: facturados });

    pagoAprobado = pago;

    emitirAEvento(pago.evento_id, EVENTOS_WS.PAGO_ACTUALIZADO, {
      pagoId: pago.id,
      monto: pago.monto,
      estado: 'aprobado',
    });
  });

  if (pagoAprobado) {
    invalidar(`evento:${pagoAprobado.evento_id}`, `org:${pagoAprobado.org_id}`);
  }
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

  const admin = await db('usuario').where({ id: evento.creado_por_usuario_id }).first();
  if (!admin) {
    const error = new Error('No se encontró el admin del evento');
    error.status = 404;
    throw error;
  }

  const linkPago = await asegurarLink(
    pagoPendiente,
    `Talita Encuentros — ${evento.nombre}`
  );

  const plan = await estadoPlan(evento);
  const { subject, html } = templatePagoPlataformaPendiente({
    evento,
    monto: pagoPendiente.monto,
    linkPago,
    cantidadParticipantes: plan?.cant,
    limite: plan?.cap,
  });

  await enviarMail({ to: admin.email, subject, html });

  return { linkPago, monto: pagoPendiente.monto };
}

/**
 * El organizador elige de antemano el tramo que va a necesitar.
 * Paga la diferencia contra lo ya pagado; `participantes_facturados` se
 * actualiza recién cuando el webhook confirma el pago.
 */
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

  const tramoObjetivo = await pagosRepository.buscarTramoActual(participantesObjetivo);
  if (!tramoObjetivo) {
    const error = new Error('No existe un tramo para esa cantidad de participantes');
    error.status = 400;
    throw error;
  }

  const plan = await estadoPlan(evento);
  if (!plan) {
    const error = new Error('No se pudo determinar el tramo actual del evento');
    error.status = 500;
    throw error;
  }

  if (tramoObjetivo.participantes_desde <= plan.tramoPagado.participantes_desde) {
    const error = new Error('El tramo elegido debe ser mayor al que ya tenés pago');
    error.status = 400;
    throw error;
  }

  const monto = Number(tramoObjetivo.monto_fijo ?? 0) - Number(plan.tramoPagado.monto_fijo ?? 0);
  if (!(monto > 0)) {
    const error = new Error('El monto calculado no es válido');
    error.status = 400;
    throw error;
  }

  const admin = await db('usuario').where({ id: evento.creado_por_usuario_id }).first();

  const { pago, linkPago } = await db.transaction(async (trx) => {
    await pagosRepository.cancelarPagosPendientes(eventoId, trx);
    const nuevo = await pagosRepository.crearPago({ orgId, eventoId, monto, tramoId: tramoObjetivo.id }, trx);
    const link = await asegurarLink(
      nuevo,
      `Talita Encuentros — ${evento.nombre} (hasta ${tramoObjetivo.participantes_hasta} inscriptos)`,
      trx
    );
    return { pago: nuevo, linkPago: link };
  });

  if (admin) {
    const { subject, html } = templatePagoPlataformaPendiente({
      evento,
      monto,
      linkPago,
      cantidadParticipantes: plan.cant,
      limite: plan.cap,
    });
    enviarMail({ to: admin.email, subject, html });
  }

  invalidar(`evento:${eventoId}`, `org:${orgId}`);
  return { linkPago, monto, tramo: tramoObjetivo, pagoId: pago.id };
}

async function listarTramos() {
  return getOrSet('global', 'tramos_precio', async () => {
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

  return getOrSet(`evento:${eventoId}`, 'pagos_evento', async () => {
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
  });
}

async function listarEventosActivos(orgId) {
  return getOrSet(`org:${orgId}`, 'eventos_activos_pago', () => (
    pagosRepository.listarEventosActivosConPago(orgId)
  ));
}

async function listarHistorial(orgId) {
  return getOrSet(`org:${orgId}`, 'historial_pagos', () => (
    pagosRepository.listarHistorialPagos(orgId)
  ));
}

module.exports = {
  verificarYGenerarCargo,
  verificarCapacidadInscripcion,
  procesarWebhookAprobado,
  pagarTramoAdelantado,
  reenviarMailPago,
  listarTramos,
  listarPagosEvento,
  listarEventosActivos,
  listarHistorial
};