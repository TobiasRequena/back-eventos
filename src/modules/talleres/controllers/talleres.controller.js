const talleresService = require('../services/talleres.service');

async function crear(req, res, next) {
  try {
    const taller = await talleresService.crearTaller(req.params.eventoId, req.orgId, req.body);
    res.status(201).json({ taller });
  } catch (error) {
    next(error);
  }
}

async function listar(req, res, next) {
  try {
    const talleres = await talleresService.listarTalleres(req.params.eventoId, req.orgId);
    res.status(200).json({ talleres });
  } catch (error) {
    next(error);
  }
}

async function obtener(req, res, next) {
  try {
    const taller = await talleresService.obtenerTaller(req.params.id, req.orgId);
    res.status(200).json({ taller });
  } catch (error) {
    next(error);
  }
}

async function editar(req, res, next) {
  try {
    const taller = await talleresService.editarTaller(req.params.id, req.orgId, req.body);
    res.status(200).json({ taller });
  } catch (error) {
    next(error);
  }
}

async function eliminar(req, res, next) {
  try {
    await talleresService.eliminarTaller(req.params.id, req.orgId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

async function listarInscriptos(req, res, next) {
  try {
    const inscriptos = await talleresService.listarInscriptos(req.params.id, req.orgId);
    res.status(200).json({ inscriptos });
  } catch (error) {
    next(error);
  }
}

async function asignarParticipante(req, res, next) {
  try {
    const inscripcion = await talleresService.asignarParticipante(
      req.params.id,
      req.orgId,
      req.body.participanteId
    );
    res.status(201).json({ inscripcion });
  } catch (error) {
    next(error);
  }
}

async function desasignarParticipante(req, res, next) {
  try {
    await talleresService.desasignarParticipante(
      req.params.id,
      req.orgId,
      req.params.participanteId
    );
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  crear,
  listar,
  obtener,
  editar,
  eliminar,
  listarInscriptos,
  asignarParticipante,
  desasignarParticipante,
};