const jwt = require('jsonwebtoken');

/**
 * Acepta tanto el JWT de usuario (admin) como el JWT liviano de referente.
 * Inyecta req.usuario o req.referente según el tipo de token.
 * Se usa en endpoints que pueden ser accedidos por ambos roles,
 * como PATCH /participantes/:id/vinculo.
 */
function autenticarAdminOReferente(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const error = new Error('Token no provisto');
    error.status = 401;
    return next(error);
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    if (payload.tipo === 'referente') {
      // Token de referente
      req.referente = payload;
    } else {
      // Token de usuario normal (admin)
      req.usuario = payload;
    }

    next();
  } catch (err) {
    const error = new Error('Token inválido o expirado');
    error.status = 401;
    return next(error);
  }
}

module.exports = autenticarAdminOReferente;