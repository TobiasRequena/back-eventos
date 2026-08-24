const fichaMedicaService = require('../services/fichaMedica.service');

async function obtenerFicha(req, res, next) {
  try {
    const ficha = await fichaMedicaService.obtenerFicha(req.params.id, req.orgId);
    res.status(200).json({ ficha });
  } catch (error) { next(error); }
}

async function guardarFicha(req, res, next) {
  try {
    const ficha = await fichaMedicaService.guardarFicha(req.params.id, req.orgId, req.body);
    res.status(200).json({ ficha });
  } catch (error) { next(error); }
}

module.exports = { obtenerFicha, guardarFicha };