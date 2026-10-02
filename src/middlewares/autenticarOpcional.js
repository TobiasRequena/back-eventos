const jwt = require('jsonwebtoken');

/**
 * Como autenticar, pero sin sesión (o con un token inválido) sigue de largo
 * como anónimo en vez de cortar con 401.
 */
function autenticarOpcional(req, res, next) {
  const [tipo, token] = (req.headers.authorization ?? '').split(' ');
  if (tipo === 'Bearer' && token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      if (!payload.tipo || payload.tipo === 'admin') req.usuario = payload;
    } catch {
      // token vencido o inválido: se trata como anónimo
    }
  }
  next();
}

module.exports = autenticarOpcional;
