const express = require('express');
const router = express.Router();
const soporteController = require('../controllers/soporte.controller');
const validate = require('../../../middlewares/validate');
const { contactoSchema } = require('../schemas/soporte.schema');

router.post('/contacto', validate(contactoSchema), soporteController.contacto);

module.exports = router;