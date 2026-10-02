const express = require('express');
const router = express.Router();
const asistenteController = require('../controllers/asistente.controller');
const validate = require('../../../middlewares/validate');
const autenticar = require('../../../middlewares/autenticar');
const autenticarOpcional = require('../../../middlewares/autenticarOpcional');
const { limiterPublico } = require('../../../middlewares/rateLimit');
const { chatSchema, guardarBorradorSchema } = require('../schemas/asistente.schema');

// Público: se usa desde la landing (anónimo) y desde el sistema (con sesión)
router.post('/', limiterPublico, autenticarOpcional, validate(chatSchema), asistenteController.chat);

// Borrador del usuario logueado: así lo ve desde cualquier dispositivo
router.get('/borrador', autenticar, asistenteController.obtenerBorrador);
router.put('/borrador', autenticar, validate(guardarBorradorSchema), asistenteController.guardarBorrador);
router.delete('/borrador', autenticar, asistenteController.borrarBorrador);

module.exports = router;
