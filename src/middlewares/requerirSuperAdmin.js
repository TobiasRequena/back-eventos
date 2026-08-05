// requerirSuperAdmin.js
function requerirSuperAdmin(req, res, next) {
  if (!req.usuario?.esSuperAdmin) {
    const error = new Error('Acceso restringido a super administradores');
    error.status = 403;
    return next(error);
  }
  next();
}

module.exports = requerirSuperAdmin;