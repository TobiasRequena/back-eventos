const { db } = require('../config/db');

/**
 * Verifica que el evento no tenga pagos pendientes de plataforma
 * cuando faltan 3 días o menos para su inicio.
 *
 * Se aplica en las rutas de acreditación — si hay deuda, bloquea
 * con 402 (Payment Required) y un mensaje claro.
 *
 * Si faltan más de 3 días, no bloquea aunque haya deuda pendiente
 * (el admin tiene tiempo de regularizar).
 */
async function verificarPagoEvento(req, res, next) {
  try {
    const eventoId = req.body.eventoId ?? req.params.eventoId ?? req.query.eventoId;
    if (!eventoId) return next();

    const evento = await db('evento').where({ id: eventoId }).first();
    if (!evento) return next();

    // Calcular días hasta el evento
    const ahora = new Date();
    const fechaInicio = new Date(evento.fecha_inicio);
    const diasRestantes = (fechaInicio - ahora) / (1000 * 60 * 60 * 24);

    // Solo bloquear si faltan 3 días o menos
    if (diasRestantes > 3) return next();

    // Verificar si hay pagos pendientes de plataforma
    const pagoPendiente = await db('pago')
      .where({
        evento_id: eventoId,
        tipo: 'creacion_evento',
        estado: 'pendiente',
      })
      .first();

    if (pagoPendiente) {
      return res.status(402).json({
        error: {
          message: 'Hay un pago de plataforma pendiente para este evento. Regularizá el pago antes de acreditar.',
          pagoId: pagoPendiente.id,
          monto: pagoPendiente.monto,
        },
      });
    }

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = verificarPagoEvento;