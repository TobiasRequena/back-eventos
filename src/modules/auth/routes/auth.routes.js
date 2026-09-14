const express = require('express');
const router = express.Router();

const authController = require('../controllers/auth.controller');
const validate = require('../../../middlewares/validate');
const autenticar = require('../../../middlewares/autenticar');
const { limiterAuth } = require('../../../middlewares/rateLimit');
const { registerSchema, loginSchema } = require('../schemas/auth.schema');
const { recuperarContrasenaSchema, resetContrasenaSchema } = require('../schemas/auth.schema');
const { verificarEmailSchema, reenviarVerificacionSchema } = require('../schemas/auth.schema');

router.post('/recuperar-contrasena', limiterAuth, validate(recuperarContrasenaSchema), authController.recuperarContrasena);
router.post('/reset-contrasena', limiterAuth, validate(resetContrasenaSchema), authController.resetContrasena);

router.post('/verificar-email', limiterAuth, validate(verificarEmailSchema), authController.verificarEmail);
router.post('/reenviar-verificacion', limiterAuth, validate(reenviarVerificacionSchema), authController.reenviarVerificacion);

// POST /api/v1/auth/register — público, valida el body con Zod antes de llegar al controller
router.post('/register', limiterAuth, validate(registerSchema), authController.register);

// POST /api/v1/auth/login — público
router.post('/login', limiterAuth, validate(loginSchema), authController.login);

// GET /api/v1/auth/me — protegido: primero pasa por "autenticar" (decodifica el JWT),
// y solo si pasa esa validación, llega al controller
router.get('/me', autenticar, authController.me);

module.exports = router;