/**
 * Verifica que el rol guardado en req.vinculoOrganizacion (por el middleware
 * verificarPertenenciaOrganizacion, que debe ejecutarse ANTES que este)
 * esté dentro de los roles permitidos para la operación.
 *
 * Factory: recibe la lista de roles permitidos y devuelve el middleware,
 * así se puede reusar para distintas combinaciones según el endpoint
 * (ej. requerirRol('admin') hoy, y el día de mañana quizás
 * requerirRol('admin', 'editor') si crece el enum rol_usuario_org).
 */
function requerirRol(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.vinculoOrganizacion) {
      // Esto sería un error de programación nuestro (olvidar poner
      // verificarPertenenciaOrganizacion antes), no del usuario —
      // pero lo manejamos igual para no crashear feo.
      const error = new Error('No se pudo verificar el rol del usuario');
      error.status = 500;
      return next(error);
    }

    if (!rolesPermitidos.includes(req.vinculoOrganizacion.rol)) {
      const error = new Error('No tenés el rol necesario para esta acción');
      error.status = 403;
      return next(error);
    }

    next();
  };
}

module.exports = requerirRol;