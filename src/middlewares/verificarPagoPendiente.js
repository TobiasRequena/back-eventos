const { db } = require('../config/db');
const participantesRepository = require('../modules/participantes/repositories/participantes.repository');

async function verificarPagoPendiente(req, res, next) {
  try {
    let eventoId =
      req.params.eventoId ??
      req.params.id ??
      req.body?.eventoId ??
      req.query?.eventoId;

    if (!eventoId && req.params.esquemaId) {
      const esquema = await db('esquema_grupos_trabajo')
        .where({ id: req.params.esquemaId })
        .select('evento_id')
        .first();
      if (esquema) eventoId = esquema.evento_id;
    }

    if (!eventoId) return next();

    // Verificar si hay pago pendiente
    const pagoPendiente = await db('pago')
      .where({ evento_id: eventoId, tipo: 'creacion_evento', estado: 'pendiente' })
      .first();

    if (!pagoPendiente) return next();

    // Hay pago pendiente → verificar si además superó el límite del rango pagado
    const evento = await db('evento').where({ id: eventoId }).first();
    if (!evento) return next();

    const cantidadActual = await participantesRepository.contarPorEvento(eventoId);

    // Buscar el rango que pagaron
    const rangoFacturado = evento.participantes_facturados > 0
      ? await db('tramo_precio_plataforma')
        .where('participantes_desde', '<=', evento.participantes_facturados)
        .where('activo', true)
        .orderBy('participantes_desde', 'desc')
        .first()
      : await db('tramo_precio_plataforma')
        .where('participantes_desde', 0)
        .where('activo', true)
        .first();

    if (!rangoFacturado) return next();

    // Bloquear solo si superó el límite del rango pagado
    if (cantidadActual > rangoFacturado.participantes_hasta) {
      return res.status(402).json({
        error: {
          message: 'Hay un pago de plataforma pendiente y superaste el límite de tu plan. Regularizá el pago para continuar.',
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

module.exports = verificarPagoPendiente;