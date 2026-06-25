const organizacionesService = require('../services/organizaciones.service');

/**
 * GET /api/v1/organizaciones
 * Lista las organizaciones del usuario autenticado.
 */
async function listarMias(req, res, next) {
  try {
    const organizaciones = await organizacionesService.listarMisOrganizaciones(req.usuario.sub);
    res.status(200).json({ organizaciones });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/v1/organizaciones/:id
 * Completa/edita el nombre de la organización (saca es_implicita).
 */
async function completar(req, res, next) {
  try {
    const { id } = req.params;
    const { nombre } = req.body;

    const organizacion = await organizacionesService.completarOrganizacion(id, { nombre });

    res.status(200).json({ organizacion });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/organizaciones/:id/miembros
 */
async function listarMiembros(req, res, next) {
  try {
    const { id } = req.params;
    const miembros = await organizacionesService.listarMiembros(id);
    res.status(200).json({ miembros });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/organizaciones/:id/miembros
 * Invita un usuario existente. Si la organización sigue implícita,
 * requiere nombreOrganizacion en el body (la completa en el mismo paso).
 */
async function invitarMiembro(req, res, next) {
  try {
    const { id } = req.params;
    const { email, nombreOrganizacion } = req.body;

    const resultado = await organizacionesService.invitarMiembro(id, {
      email,
      nombreOrganizacion,
    });

    res.status(201).json(resultado);
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/v1/organizaciones/:id/miembros/:usuarioId
 */
async function quitarMiembro(req, res, next) {
  try {
    const { id, usuarioId } = req.params;
    await organizacionesService.quitarMiembro(id, usuarioId);
    res.status(204).send(); // 204 No Content: éxito, sin body que devolver
  } catch (error) {
    next(error);
  }
}

module.exports = { listarMias, completar, listarMiembros, invitarMiembro, quitarMiembro };