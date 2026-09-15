const zonasCostoService = require('../services/zonasCosto.service');

async function listar(req, res, next) {
  try {
    const zonas = await zonasCostoService.listarZonas(req.params.eventoId, req.orgId);
    res.status(200).json({ zonas });
  } catch (error) {
    next(error);
  }
}

async function crear(req, res, next) {
  try {
    const zona = await zonasCostoService.crearZona(req.params.eventoId, req.orgId, req.body);
    res.status(201).json({ zona });
  } catch (error) {
    next(error);
  }
}

async function editar(req, res, next) {
  try {
    const zona = await zonasCostoService.editarZona(
      req.params.eventoId,
      req.params.zonaId,
      req.orgId,
      req.body
    );
    res.status(200).json({ zona });
  } catch (error) {
    next(error);
  }
}

async function eliminar(req, res, next) {
  try {
    await zonasCostoService.eliminarZona(req.params.eventoId, req.params.zonaId, req.orgId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

module.exports = { listar, crear, editar, eliminar };
