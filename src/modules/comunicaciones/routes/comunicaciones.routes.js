const express = require('express');
const multer = require('multer');
const router = express.Router({ mergeParams: true });

const upload = multer({ storage: multer.memoryStorage() });
const comunicacionesController = require('../controllers/comunicaciones.controller');
const autenticar = require('../../../middlewares/autenticar');
const resolverOrganizacionActiva = require('../../../middlewares/resolverOrganizacionActiva');
const validate = require('../../../middlewares/validate');
const parsearFiltros = require('../../../middlewares/parsearFiltros');
const { enviarComunicacionSchema, listarComunicacionesSchema } = require('../schemas/comunicaciones.schema');

router.use(autenticar);
router.use(resolverOrganizacionActiva);

router.post(
  '/',
  upload.array('adjuntos', 5),
  parsearFiltros,
  validate(enviarComunicacionSchema),
  comunicacionesController.enviarComunicacion
);

router.get(
  '/',
  validate(listarComunicacionesSchema),
  comunicacionesController.listarComunicaciones
);

module.exports = router;