const pagosInscripcionService = require('../services/pagosInscripcion.service');

async function revisarCuota(req, res, next) {
  try {
    const resultado = await pagosInscripcionService.revisarCuota(
      req.params.pagoId,
      req.orgId,
      req.usuario?.sub,
      req.body.estado
    );
    res.status(200).json(resultado);
  } catch (error) { next(error); }
}

module.exports = { revisarCuota };
