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
  let montoDiferencia = null;

  await db.transaction(async (trx) => {
    const evento = await eventosRepository.buscarPorId(eventoId, trx);
    if (!evento) return;

    cantidadActual = await participantesRepository.contarPorEvento(eventoId, trx);
    eventoNombre = evento.nombre;

    const tramoActual = await pagosRepository.buscarTramoActual(cantidadActual, trx);
    const tramoFacturado = evento.participantes_facturados > 0
      ? await pagosRepository.buscarTramoActual(evento.participantes_facturados, trx)
      : null;

    // Sin tramo todavía → no hay nada que cobrar
    if (!tramoActual) return;

    const mismoTramo = tramoFacturado && tramoActual.id === tramoFacturado.id;

    // ─── MISMO TRAMO ────────────────────────────────────────────────────────
    if (mismoTramo) {
      const pagoPendiente = await pagosRepository.buscarPagoPendientePorEvento(eventoId, trx);
      const pagoAprobado = !pagoPendiente || pagoPendiente.estado === 'aprobado';
      const limiteGracia = Math.floor(tramoActual.participantes_desde * 1.10);
      const dentroDeGracia = cantidadActual <= limiteGracia;

      if (dentroDeGracia && pagoAprobado) {
        // Dentro de gracia y sin deuda → todos los pendientes pasan a confirmado
        await trx('participante')
          .where({ evento_id: eventoId, estado_alta_plataforma: 'pendiente_pago_org' })
          .update({ estado_alta_plataforma: 'confirmado' });
        return;
      }

      if (!dentroDeGracia) {
        // Fuera de gracia → marcar último participante como pendiente
        await trx('participante')
          .where('id', function () {
            this.select('id')
              .from('participante')
              .where({ evento_id: eventoId, activo: true })
              .orderBy('creado_en', 'desc')
              .limit(1);
          })
          .update({ estado_alta_plataforma: 'pendiente_pago_org' });

        // Solo generar nuevo pago si no hay uno pendiente ya
        if (pagoAprobado) {
          montoDiferencia = Math.round(
            tramoActual.precio_por_participante * tramoActual.participantes_desde
          );
          if (montoDiferencia > 0) {
            const pago = await pagosRepository.crearPago(
              { orgId: evento.org_id, eventoId, monto: montoDiferencia },
              trx
            );
            pagoId = pago.id;
            const admin = await db('usuario').where({ id: evento.creado_por_usuario_id }).first();
            adminEmail = admin?.email;
          }
        }
      }
      return;
    }

    // ─── CAMBIO DE TRAMO ────────────────────────────────────────────────────
    const limiteGraciaAnterior = tramoFacturado
      ? Math.floor(tramoFacturado.participantes_desde * 1.10)
      : Math.floor(tramoActual.participantes_desde * 1.10);

    const graciaAnteriorVencida = cantidadActual > limiteGraciaAnterior;

    // Si la gracia anterior no venció → actualizar tramo facturado y no cobrar
    if (!graciaAnteriorVencida) {
      await trx('evento')
        .where({ id: eventoId })
        .update({ participantes_facturados: tramoActual.participantes_desde });
      return;
    }

    // Gracia anterior venció → marcar último participante como pendiente
    await trx('participante')
      .where('id', function () {
        this.select('id')
          .from('participante')
          .where({ evento_id: eventoId, activo: true })
          .orderBy('creado_en', 'desc')
          .limit(1);
      })
      .update({ estado_alta_plataforma: 'pendiente_pago_org' });

    // Cancelar pago pendiente anterior si existe y calcular monto consolidado
    const pagoPendienteAnterior = await pagosRepository.buscarPagoPendientePorEvento(eventoId, trx);
    console.log('[pagos] buscando pendiente para evento:', eventoId);
    console.log('[pagos] encontrado:', pagoPendienteAnterior?.id, pagoPendienteAnterior?.estado);
    if (pagoPendienteAnterior) {
      const cancelados = await pagosRepository.cancelarPagosPendientes(eventoId, trx);
      console.log('[pagos] pagos cancelados:', cancelados);

      await pagosRepository.cancelarPagosPendientes(eventoId, trx);
      // Monto consolidado: total del nuevo tramo (no diferencia)
      montoDiferencia = Math.round(
        tramoActual.precio_por_participante * tramoActual.participantes_desde
      );
    } else {
      // Sin pendiente anterior: diferencia entre tramos
      const costoNuevo = tramoActual.precio_por_participante * tramoActual.participantes_desde;
      const costoFacturado = tramoFacturado
        ? tramoFacturado.precio_por_participante * tramoFacturado.participantes_desde
        : 0;
      montoDiferencia = Math.round(costoNuevo - costoFacturado);
    }

    if (montoDiferencia <= 0) return;

    await trx('evento')
      .where({ id: eventoId })
      .update({ participantes_facturados: tramoActual.participantes_desde });

    const pago = await pagosRepository.crearPago(
      { orgId: evento.org_id, eventoId, monto: montoDiferencia },
      trx
    );
    pagoId = pago.id;

    const admin = await db('usuario').where({ id: evento.creado_por_usuario_id }).first();
    adminEmail = admin?.email;
  });

  // Llamada a GalioPay FUERA de la transacción
  if (!pagoId || !montoDiferencia) return;

  try {
    const evento = await eventosRepository.buscarPorId(eventoId);

    const paymentLink = await crearPaymentLink({
      monto: montoDiferencia,
      referenceId: pagoId,
      descripcion: `Talita Encuentros — ${eventoNombre} (${cantidadActual} inscriptos)`,
      sandbox: process.env.GALIOPAY_SANDBOX === 'true',
    });

    await pagosRepository.actualizarRefPasarela(pagoId, paymentLink.referenceId);

    if (adminEmail) {
      const { subject, html } = templatePagoPlataformaPendiente({
        emailAdmin: adminEmail,
        evento,
        monto: montoDiferencia,
        linkPago: paymentLink.url,
        cantidadParticipantes: cantidadActual,
      });
      enviarMail({ to: adminEmail, subject, html });
    }
  } catch (err) {
    console.error('[pagos] Error al crear payment link en GalioPay:', err.message);
  }
}

/**
 * Webhook de GalioPay — se llama cuando un pago se aprueba.
 * Promueve todos los participantes pendiente_pago_org → confirmado
 * y les manda los mails con QR.
 */
async function procesarWebhookAprobado(refPasarela, galioPaymentId) {
  return db.transaction(async (trx) => {
    // Buscar SIN aprobar todavía
    const pago = await trx('pago').where({ ref_pasarela: refPasarela }).first();

    if (!pago) {
      console.error('[webhook] No se encontró pago con ref:', refPasarela);
      return;
    }

    // Pago cancelado → reembolso automático, no aprobar
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

    // Pago ya aprobado → webhook duplicado, ignorar
    if (pago.estado === 'aprobado') {
      console.log('[webhook] Webhook duplicado ignorado:', refPasarela);
      return;
    }

    await trx('pago').where({ id: pago.id }).update({ estado: 'aprobado' });

    invalidar(`evento:${pago.evento_id}`);
    invalidar(`admin:stats:${pago.evento_id}`);

    const participantesPendientes = await trx('participante')
      .where({ evento_id: pago.evento_id, estado_alta_plataforma: 'pendiente_pago_org' })
      .select('*');

    console.log('[webhook] participantes pendientes:', participantesPendientes.length);

    if (participantesPendientes.length > 0) {
      await trx('participante')
        .where({ evento_id: pago.evento_id, estado_alta_plataforma: 'pendiente_pago_org' })
        .update({ estado_alta_plataforma: 'confirmado' });
    }

    // Emitir SIEMPRE — con o sin participantes pendientes
    emitirAEvento(pago.evento_id, EVENTOS_WS.PAGO_ACTUALIZADO, {
      pagoId: pago.id,
      monto: pago.monto,
      estado: 'aprobado',
      participantesConfirmados: participantesPendientes.length,
    });

    if (participantesPendientes.length === 0) return;

    const evento = await eventosRepository.buscarPorId(pago.evento_id, trx);
    const { desencriptar } = require('../../../utils/encryption');
    const { generarCredencial } = require('../../../utils/generarCredencial');
    const { templateConfirmacionInscripcion } = require('../../../utils/mailTemplates');

    for (const participante of participantesPendientes) {
      try {
        let dniLegible = participante.dni;
        try { dniLegible = desencriptar(participante.dni); } catch { }

        const credencialBuffer = await generarCredencial({
          qrPersonal: participante.qr_personal,
          nombreEvento: evento.nombre,
          nombreParticipante: `${participante.nombre} ${participante.apellido}`,
          dni: dniLegible,
        });

        let grupo = null;
        if (participanteActualizado.grupo_id) {
          grupo = await gruposRepository.buscarPorId(participanteActualizado.grupo_id);
        }

        const { subject, html } = templateConfirmacionInscripcion({
          participante: { ...participanteActualizado, dni: datosParaMail.dni },
          evento,
          grupo,
        });

        enviarMail({
          to: participante.email,
          subject,
          html,
          attachments: [{
            filename: `credencial_${dniLegible}.png`,
            content: credencialBuffer,
            contentType: 'image/png',
          }],
        });
      } catch (err) {
        console.error(`[webhook] Error al enviar mail a ${participante.email}:`, err.message);
      }
    }
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