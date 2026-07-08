const participantesService = require('../services/participantes.service');

/**
 * POST /api/v1/participantes
 * Crea un participante nuevo en un evento.
 * El eventoId viene en el body (no en la URL) — mismo patrón que archivos.
 */
async function crear(req, res, next) {
  try {
    // req.orgId puede ser undefined si viene de inscripción pública (sin X-Org-Id)
    // El service lo resuelve a partir del eventoId en ese caso
    const participante = await participantesService.crearParticipante(
      req.orgId ?? null,
      req.body
    );
    res.status(201).json({ participante });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/eventos/:eventoId/participantes
 * Lista los participantes de un evento con filtros opcionales por query string:
 * ?grupoId=...&rolGrupo=...&estadoPago=...&estadoVinculo=...
 */
async function listar(req, res, next) {
  try {
    const { grupoId, rolGrupo, estadoPago, estadoVinculo } = req.query;

    const participantes = await participantesService.listarParticipantes(
      req.params.eventoId,
      req.orgId,
      { grupoId, rolGrupo, estadoPago, estadoVinculo }
    );

    res.status(200).json({ participantes });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/participantes/:id
 */
async function obtener(req, res, next) {
  try {
    const participante = await participantesService.obtenerParticipante(req.params.id, req.orgId);
    res.status(200).json({ participante });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/v1/participantes/:id
 */
async function editar(req, res, next) {
  try {
    const participante = await participantesService.editarParticipante(
      req.params.id,
      req.orgId,
      req.body
    );
    res.status(200).json({ participante });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/v1/participantes/:id
 */
async function eliminar(req, res, next) {
  try {
    await participantesService.eliminarParticipante(req.params.id, req.orgId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/v1/participantes/:id/vinculo
 * Aprueba o rechaza el vínculo de un autoinscripto (RN04).
 * Solo debería llamarlo el responsable del grupo — esa validación
 * la agregamos cuando construyamos el módulo grupos completo.
 */
async function actualizarEstadoVinculo(req, res, next) {
  try {
    const participante = await participantesService.actualizarEstadoVinculo(
      req.params.id,
      req.orgId,
      req.body.estado
    );
    res.status(200).json({ participante });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/participantes/:id/ultima-ubicacion
 * RN12.1 — devuelve null hasta que exista el módulo acreditación.
 */
async function obtenerUltimaUbicacion(req, res, next) {
  try {
    const ubicacion = await participantesService.obtenerUltimaUbicacion(req.params.id, req.orgId);
    res.status(200).json({ ubicacion });
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
  actualizarEstadoVinculo,
  obtenerUltimaUbicacion,
};