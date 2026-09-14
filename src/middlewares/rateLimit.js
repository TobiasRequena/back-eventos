const rateLimit = require('express-rate-limit');

function crearHandler(message) {
  return (req, res) => {
    res.status(429).json({ error: { message } });
  };
}

// Límite global: cubre cualquier ruta que no tenga un limiter más específico
const limiterGlobal = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: crearHandler('Demasiadas solicitudes, intentá de nuevo más tarde'),
});

// Límite estricto para endpoints de auth sensibles (login, register, reset, etc.)
const limiterAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: crearHandler('Demasiados intentos, esperá unos minutos antes de volver a intentar'),
});

// Límite intermedio para endpoints públicos de negocio (acreditación, inscripción, contacto)
const limiterPublico = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: crearHandler('Demasiadas solicitudes, intentá de nuevo más tarde'),
});

module.exports = { limiterGlobal, limiterAuth, limiterPublico };
