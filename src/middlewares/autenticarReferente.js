const jwt = require('jsonwebtoken');

/**
 * Verifica el JWT liviano del referente (distinto al JWT de usuario).
 * Inyecta req.referente con { grupoId, participanteId, orgId, eventoId }.
 *
 * Se usa en las rutas del panel de referente — no en las rutas de admin.
 */
function autenticarReferente(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const error = new Error('Token no provisto');
    error.status = 401;
    return next(error);
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Verificar que sea un token de referente, no de usuario normal
    if (payload.tipo !== 'referente') {
      const error = new Error('Token inválido para esta operación');
      error.status = 403;
      return next(error);
    }

    req.referente = payload;
    next();
  } catch (err) {
    const error = new Error('Token inválido o expirado');
    error.status = 401;
    return next(error);
  }
}

module.exports = autenticarReferente;