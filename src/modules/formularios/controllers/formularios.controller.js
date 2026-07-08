const formulariosService = require('../services/formularios.service');

async function listar(req, res, next) {
  try {
    const campos = await formulariosService.listarCampos(req.params.eventoId, req.orgId);
    res.status(200).json({ campos });
  } catch (error) {
    next(error);
  }
}

async function crear(req, res, next) {
  try {
    const campo = await formulariosService.crearCampo(req.params.eventoId, req.orgId, req.body);
    res.status(201).json({ campo });
  } catch (error) {
    next(error);
  }
}

async function editar(req, res, next) {
  try {
    const campo = await formulariosService.editarCampo(
      req.params.eventoId,
      req.params.campoId,
      req.orgId,
      req.body
    );
    res.status(200).json({ campo });
  } catch (error) {
    next(error);
  }
}

async function eliminar(req, res, next) {
  try {
    await formulariosService.eliminarCampo(
      req.params.eventoId,
      req.params.campoId,
      req.orgId
    );
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

async function reordenar(req, res, next) {
  try {
    await formulariosService.reordenarCampos(
      req.params.eventoId,
      req.orgId,
      req.body.campos
    );
    res.status(200).json({ mensaje: 'Campos reordenados correctamente' });
  } catch (error) {
    next(error);
  }
}

module.exports = { listar, crear, editar, eliminar, reordenar };