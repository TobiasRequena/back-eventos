const express = require('express');
const router = express.Router();

const authController = require('../controllers/auth.controller');
const validate = require('../../../middlewares/validate');
const autenticar = require('../../../middlewares/autenticar');
const { registerSchema, loginSchema } = require('../schemas/auth.schema');

// POST /api/v1/auth/register — público, valida el body con Zod antes de llegar al controller
router.post('/register', validate(registerSchema), authController.register);

// POST /api/v1/auth/login — público
router.post('/login', validate(loginSchema), authController.login);

// GET /api/v1/auth/me — protegido: primero pasa por "autenticar" (decodifica el JWT),
// y solo si pasa esa validación, llega al controller
router.get('/me', autenticar, authController.me);

module.exports = router;