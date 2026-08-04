const { db } = require('../config/db');

/**
 * @param {number} horasAntes - horas antes del evento para bloquear (default 72 = 3 días)
 */
function verificarPagoEvento(horasAntes = 72) {
  return async function (req, res, next) {
    try {
      // Priorizar URL params (req.params.eventoId), luego req.body y req.query
      let eventoId = req.params?.eventoId ?? req.body?.eventoId ?? req.query?.eventoId;

      // Si no se obtuvo un eventoId válido pero existe esquemaId en los params, buscar el eventoId desde el esquema
      if ((!eventoId || eventoId === 'undefined') && req.params?.esquemaId && req.params.esquemaId !== 'undefined') {
        const esquema = await db('esquema_grupos_trabajo')
          .where({ id: req.params.esquemaId })
          .select('evento_id')
          .first();
        if (esquema) {
          eventoId = esquema.evento_id;
        }
      }

      if (!eventoId || eventoId === 'undefined') return next();

      const evento = await db('evento').where({ id: eventoId }).first();
      if (!evento || !evento.fecha_inicio) return next();

      const ahora = new Date();
      const fechaInicio = new Date(evento.fecha_inicio);
      const horasRestantes = (fechaInicio - ahora) / (1000 * 60 * 60);

      if (horasRestantes > horasAntes) return next();

      const pagoPendiente = await db('pago')
        .where({ evento_id: eventoId, tipo: 'creacion_evento', estado: 'pendiente' })
        .first();

      if (pagoPendiente) {
        return res.status(402).json({
          error: {
            message: `Hay un pago de plataforma pendiente para este evento. Regularizá el pago antes de continuar.`,
            pagoId: pagoPendiente.id,
            monto: pagoPendiente.monto,
          },
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = verificarPagoEvento;