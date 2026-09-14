const express = require('express');
const router = express.Router();
const soporteController = require('../controllers/soporte.controller');
const validate = require('../../../middlewares/validate');
const { limiterPublico } = require('../../../middlewares/rateLimit');
const { contactoSchema } = require('../schemas/soporte.schema');

router.post('/contacto', limiterPublico, validate(contactoSchema), soporteController.contacto);

module.exports = router;