const { db } = require('../config/db');

/**
 * Lee el header X-Org-Id, valida que sea un UUID y que el usuario
 * autenticado (req.usuario.sub) pertenezca a esa organización.
 *
 * Reemplaza a verificarPertenenciaOrganizacion para los módulos que usan
 * rutas planas (eventos, y todo lo que venga después) en lugar de rutas
 * anidadas bajo /organizaciones/:id/...
 *
 * Al pasar, inyecta:
 *   req.orgId               -> el id de la organización activa
 *   req.vinculoOrganizacion -> { usuario_id, org_id, rol } por si se necesita el rol
 */
async function resolverOrganizacionActiva(req, res, next) {
  const orgId = req.headers['x-org-id'];

  if (!orgId) {
    const error = new Error('Falta el header X-Org-Id');
    error.status = 400;
    return next(error);
  }

  // Validación básica de formato UUID antes de ir a la base —
  // evita una query inútil si el header viene corrupto.
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(orgId)) {
    const error = new Error('X-Org-Id no es un UUID válido');
    error.status = 400;
    return next(error);
  }

  const vinculo = await db('usuario_organizacion')
    .where({ org_id: orgId, usuario_id: req.usuario.sub })
    .first();

  if (!vinculo) {
    const error = new Error('No tenés permisos sobre esta organización');
    error.status = 403;
    return next(error);
  }

  req.orgId = orgId;
  req.vinculoOrganizacion = vinculo;
  next();
}

module.exports = resolverOrganizacionActiva;