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

async function notificarAusentes(req, res, next) {
  try {
    const { participanteIds, mensaje } = req.body;
    const resultado = await comunicacionesService.notificarAusentes(
      req.params.eventoId,
      req.orgId,
      participanteIds,
      mensaje
    );
    res.status(200).json(resultado);
  } catch (error) { next(error); }
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

module.exports = { enviarComunicacion, notificarAusentes, listarComunicaciones };