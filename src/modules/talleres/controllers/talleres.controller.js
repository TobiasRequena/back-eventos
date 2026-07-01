const talleresService = require('../services/talleres.service');

// ---------- bloque_taller ----------

async function crearBloque(req, res, next) {
  try {
    const bloque = await talleresService.crearBloque(req.params.eventoId, req.orgId, req.body);
    res.status(201).json({ bloque });
  } catch (error) {
    next(error);
  }
}

async function listarBloques(req, res, next) {
  try {
    const bloques = await talleresService.listarBloques(req.params.eventoId, req.orgId);
    res.status(200).json({ bloques });
  } catch (error) {
    next(error);
  }
}

async function obtenerBloque(req, res, next) {
  try {
    const bloque = await talleresService.obtenerBloque(req.params.id, req.orgId);
    res.status(200).json({ bloque });
  } catch (error) {
    next(error);
  }
}

async function editarBloque(req, res, next) {
  try {
    const bloque = await talleresService.editarBloque(req.params.id, req.orgId, req.body);
    res.status(200).json({ bloque });
  } catch (error) {
    next(error);
  }
}

async function eliminarBloque(req, res, next) {
  try {
    await talleresService.eliminarBloque(req.params.id, req.orgId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

// ---------- taller ----------

async function crearTallerEnBloque(req, res, next) {
  try {
    const taller = await talleresService.crearTallerEnBloque(req.params.bloqueId, req.orgId, req.body);
    res.status(201).json({ taller });
  } catch (error) {
    next(error);
  }
}

async function obtenerTaller(req, res, next) {
  try {
    const taller = await talleresService.obtenerTaller(req.params.id, req.orgId);
    res.status(200).json({ taller });
  } catch (error) {
    next(error);
  }
}

async function editarTaller(req, res, next) {
  try {
    const taller = await talleresService.editarTaller(req.params.id, req.orgId, req.body);
    res.status(200).json({ taller });
  } catch (error) {
    next(error);
  }
}

async function eliminarTaller(req, res, next) {
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
  crearBloque,
  listarBloques,
  obtenerBloque,
  editarBloque,
  eliminarBloque,
  crearTallerEnBloque,
  obtenerTaller,
  editarTaller,
  eliminarTaller,
  listarInscriptos,
  asignarParticipante,
  desasignarParticipante,
};