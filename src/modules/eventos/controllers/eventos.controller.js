const eventosService = require('../services/eventos.service');

/**
 * POST /api/v1/eventos
 * Requiere autenticación + header X-Org-Id (resuelto por el middleware
 * resolverOrganizacionActiva, que inyecta req.orgId).
 */
async function crear(req, res, next) {
  try {
    const resultado = await eventosService.crearEvento(req.orgId, req.usuario.sub, req.body);
    res.status(201).json(resultado);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/eventos
 */
async function listar(req, res, next) {
  try {
    const eventos = await eventosService.listarEventos(req.orgId);
    res.status(200).json({ eventos });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/eventos/:id
 */
async function obtener(req, res, next) {
  try {
    const evento = await eventosService.obtenerEvento(req.params.id, req.orgId);
    res.status(200).json({ evento });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/v1/eventos/:id
 */
async function editar(req, res, next) {
  try {
    const evento = await eventosService.editarEvento(req.params.id, req.orgId, req.body);
    res.status(200).json({ evento });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/v1/eventos/:id
 */
async function eliminar(req, res, next) {
  try {
    await eventosService.eliminarEvento(req.params.id, req.orgId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/eventos/codigo/:codigo
 * Endpoint PÚBLICO — no pasa por "autenticar" ni por "resolverOrganizacionActiva".
 * Lo usa el formulario de inscripción que ve cualquier persona externa.
 */
async function buscarPorCodigo(req, res, next) {
  try {
    const evento = await eventosService.buscarPorCodigoPublico(req.params.codigo);
    res.status(200).json({ evento });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/eventos/codigo/:codigo/disponible
 * Requiere autenticación. Lo usan los organizadores desde el formulario
 * de creación de eventos para saber en tiempo real si el código elegido
 * ya está en uso por otro evento vigente.
 */
async function verificarDisponibilidadCodigo(req, res, next) {
  try {
    const resultado = await eventosService.verificarDisponibilidadCodigo(req.params.codigo);
    res.status(200).json(resultado);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/eventos/:id/stats
 */
async function stats(req, res, next) {
  try {
    const resultado = await eventosService.obtenerStats(req.params.id, req.orgId);
    res.status(200).json(resultado);
  } catch (error) {
    next(error);
  }
}

module.exports = { crear, listar, obtener, editar, eliminar, buscarPorCodigo, verificarDisponibilidadCodigo, stats };