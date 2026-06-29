const multer = require('multer');

/**
 * Multer en modo "memoria" (no guarda en disco) — el archivo llega
 * como Buffer en req.file.buffer, listo para mandarlo directo a R2
 * sin pasar por el filesystem local. Tiene sentido para archivos chicos
 * como portadas de evento o comprobantes (no para videos pesados, por ejemplo).
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB — mismo límite que ya validamos en el service,
    // pero esto corta ANTES de que el archivo termine
    // de subirse, ahorrando ancho de banda si alguien
    // intenta mandar algo más grande.
  },
});

module.exports = upload;