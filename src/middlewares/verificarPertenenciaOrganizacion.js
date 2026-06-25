const { db } = require('../config/db');

/**
 * Verifica que el usuario autenticado (req.usuario.sub) pertenezca a la
 * organización indicada en los params de la ruta (por defecto, :id).
 *
 * Este middleware va DESPUÉS de "autenticar" en la cadena, porque necesita
 * que req.usuario ya esté inyectado.
 *
 * Se usa como factory (función que devuelve un middleware) en vez de un
 * middleware fijo, porque no todas las rutas usan el mismo nombre de param
 * para el id de organización (acá es :id, pero en otros módulos podría
 * llegar como :orgId, por ejemplo).
 */
function verificarPertenenciaOrganizacion(paramName = 'id') {
  return async (req, res, next) => {
    const orgId = req.params[paramName];
    const usuarioId = req.usuario.sub;

    const vinculo = await db('usuario_organizacion')
      .where({ org_id: orgId, usuario_id: usuarioId })
      .first();

    if (!vinculo) {
      const error = new Error('No tenés permisos sobre esta organización');
      error.status = 403; // 403 Forbidden: está autenticado, pero no autorizado para ESTO
      return next(error);
    }

    // Guardamos el rol en req, por si algún controller más adelante necesita
    // distinguir comportamiento según rol (hoy solo existe 'admin', pero
    // el enum está pensado para crecer).
    req.vinculoOrganizacion = vinculo;
    next();
  };
}

module.exports = verificarPertenenciaOrganizacion;