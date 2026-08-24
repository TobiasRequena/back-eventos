const pagosService = require('../services/pagos.service');

/**
 * POST /api/v1/pagos/webhook/galiopay
 * GalioPay llama a este endpoint cuando un pago se aprueba.
 */
// En pagos.controller.js:
async function webhookGaliopay(req, res, next) {
  try {
    console.log('[webhook] GalioPay payload:', JSON.stringify(req.body, null, 2));
    res.status(200).json({ ok: true });
    const { status, referenceId, id: galioPaymentId } = req.body;

    if (status === 'approved' && referenceId) {
      pagosService.procesarWebhookAprobado(referenceId, galioPaymentId).catch((err) => {
        console.error('[webhook] Error procesando pago aprobado:', err.message);
      });
    }
  } catch (error) {
    next(error);
  }
}

async function reenviarMailPago(req, res, next) {
  try {
    const resultado = await pagosService.reenviarMailPago(req.params.eventoId, req.orgId);
    res.status(200).json(resultado);
  } catch (error) {
    next(error);
  }
}

async function pagarTramoAdelantado(req, res, next) {
  try {
    const resultado = await pagosService.pagarTramoAdelantado(
      req.params.eventoId,
      req.orgId,
      req.body.participantesObjetivo
    );
    res.status(200).json(resultado);
  } catch (error) {
    next(error);
  }
}

async function listarTramos(req, res, next) {
  try {
    const tramos = await pagosService.listarTramos();
    res.status(200).json({ tramos });
  } catch (error) {
    next(error);
  }
}

async function listarPagosEvento(req, res, next) {
  try {
    const resultado = await pagosService.listarPagosEvento(req.params.eventoId, req.orgId);
    res.status(200).json(resultado);
  } catch (error) {
    next(error);
  }
}

async function listarEventosActivos(req, res, next) {
  try {
    const eventos = await pagosService.listarEventosActivos(req.orgId);
    res.status(200).json({ eventos });
  } catch (error) { next(error); }
}

async function listarHistorial(req, res, next) {
  try {
    const eventos = await pagosService.listarHistorial(req.orgId);
    res.status(200).json({ eventos });
  } catch (error) { next(error); }
}

module.exports = {
  webhookGaliopay,
  reenviarMailPago,
  pagarTramoAdelantado,
  listarTramos,
  listarPagosEvento,
  listarEventosActivos,
  listarHistorial
};