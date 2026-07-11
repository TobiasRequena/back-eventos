const gruposService = require('../services/grupos.service');

async function crear(req, res, next) {
  try {
    const grupo = await gruposService.crearGrupo(req.orgId ?? null, req.body);
    res.status(201).json({ grupo });
  } catch (error) {
    next(error);
  }
}

async function listar(req, res, next) {
  try {
    const grupos = await gruposService.listarGrupos(req.params.eventoId, req.orgId);
    res.status(200).json({ grupos });
  } catch (error) {
    next(error);
  }
}

async function obtener(req, res, next) {
  try {
    const grupo = await gruposService.obtenerGrupo(req.params.id, req.orgId);
    res.status(200).json({ grupo });
  } catch (error) {
    next(error);
  }
}

async function editar(req, res, next) {
  try {
    const grupo = await gruposService.editarGrupo(req.params.id, req.orgId, req.body);
    res.status(200).json({ grupo });
  } catch (error) {
    next(error);
  }
}

async function eliminar(req, res, next) {
  try {
    await gruposService.eliminarGrupo(req.params.id, req.orgId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/grupos/invitacion/:codigoInv
 * Endpoint público — resuelve el código de invitación cuando alguien
 * escanea el QR o ingresa el código manualmente.
 */
async function resolverInvitacion(req, res, next) {
  try {
    const grupo = await gruposService.resolverCodigoInvitacion(req.params.codigoInv);
    res.status(200).json({ grupo });
  } catch (error) {
    next(error);
  }
}

async function listarIntegrantes(req, res, next) {
  try {
    const integrantes = await gruposService.listarIntegrantes(req.params.id, req.orgId);
    res.status(200).json({ integrantes });
  } catch (error) {
    next(error);
  }
}

async function listarSolicitudes(req, res, next) {
  try {
    const solicitudes = await gruposService.listarSolicitudes(req.params.id, req.orgId);
    res.status(200).json({ solicitudes });
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
  resolverInvitacion,
  listarIntegrantes,
  listarSolicitudes,
};