const jwt = require('jsonwebtoken');

/**
 * Verifica el JWT del header Authorization y, si es válido, inyecta
 * los datos decodificados en req.usuario para que los controllers
 * de cualquier módulo puedan usarlos (ej. req.usuario.sub = id del usuario).
 *
 * Si no hay token, o es inválido/expiró, corta la cadena con 401
 * antes de que el request llegue al controller.
 */
function autenticar(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: { message: 'Token no provisto' } });
    }

    const token = authHeader.split(' ')[1];

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);

        // Rechazar tokens de otro tipo (ej. referente) firmados con el mismo secret
        if (payload.tipo && payload.tipo !== 'admin') {
            return res.status(403).json({ error: { message: 'Token inválido para esta operación' } });
        }

        req.usuario = payload; // { sub: usuarioId, email, iat, exp }
        next();
    } catch (error) {
        return res.status(401).json({ error: { message: 'Token inválido o expirado' } });
    }
}

module.exports = autenticar;