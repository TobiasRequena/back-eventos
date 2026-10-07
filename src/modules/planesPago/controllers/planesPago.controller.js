const planesPagoService = require('../services/planesPago.service');

async function reemplazar(req, res, next) {
  try {
    const planes = await planesPagoService.reemplazarPlanes(req.params.eventoId, req.orgId, req.body.planes);
    res.status(200).json({ planes });
  } catch (error) {
    next(error);
  }
}

module.exports = { reemplazar };
