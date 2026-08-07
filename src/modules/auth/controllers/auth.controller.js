const authService = require('../services/auth.service');

/**
 * POST /api/v1/auth/register
 */
async function register(req, res, next) {
  try {
    const { nombre, apellido, email, contrasena, organizacion } = req.body;

    const resultado = await authService.registrar({
      nombre,
      apellido,
      email,
      contrasena,
      organizacion,
    });

    // 201 Created: se creó un recurso nuevo (usuario + organización)
    res.status(201).json(resultado);
  } catch (error) {
    // No manejamos el error acá — lo pasamos al errorHandler centralizado
    // que armamos en src/middlewares/errorHandler.js (vía next(error))
    next(error);
  }
}

/**
 * POST /api/v1/auth/login
 */
async function login(req, res, next) {
  try {
    const { email, contrasena } = req.body;

    const resultado = await authService.iniciarSesion({ email, contrasena });

    res.status(200).json(resultado);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/auth/me
 *
 * req.usuario lo inyecta el middleware de autenticación — ahí es donde se decodifica el JWT y se valida.
 */
async function me(req, res, next) {
  try {
    const resultado = await authService.obtenerPerfil(req.usuario.sub);

    res.status(200).json(resultado);
  } catch (error) {
    next(error);
  }
}

async function recuperarContrasena(req, res, next) {
  try {
    await authService.solicitarRecuperacion(req.body.email);
    // Respuesta genérica siempre — no revelar si el email existe
    res.status(200).json({ mensaje: 'Si el email existe en el sistema, recibirás un link para restablecer tu contraseña.' });
  } catch (error) {
    next(error);
  }
}

async function resetContrasena(req, res, next) {
  try {
    await authService.resetContrasena(req.body.email, req.body.codigo, req.body.nuevaContrasena);
    res.status(200).json({ mensaje: 'Contraseña actualizada correctamente.' });
  } catch (error) {
    next(error);
  }
}

module.exports = { register, login, me, recuperarContrasena, resetContrasena };