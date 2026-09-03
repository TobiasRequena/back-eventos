const comunicacionesService = require('../services/comunicaciones.service');

async function enviarComunicacion(req, res, next) {
  try {
    const resultado = await comunicacionesService.enviarComunicacion(
      req.params.eventoId,
      req.orgId,
      req.usuario.sub,
      req.body,
      req.files ?? []
    );
    res.status(202).json(resultado);
  } catch (error) {
    console.log('errroor', error)
    next(error);
  }
}

async function listarComunicaciones(req, res, next) {
  try {
    const comunicaciones = await comunicacionesService.listarComunicaciones(
      req.params.eventoId,
      req.orgId
    );
    res.status(200).json({ comunicaciones });
  } catch (error) { next(error); }
}

module.exports = { enviarComunicacion, listarComunicaciones };  