const express = require('express');
const router = express.Router();

const archivosController = require('../controllers/archivos.controller');
const validate = require('../../../middlewares/validate');
const autenticar = require('../../../middlewares/autenticar');
const upload = require('../../../middlewares/upload');
const { subirArchivoSchema, idParamSchema } = require('../schemas/archivos.schema');

// POST portada_evento — requiere auth (lo sube el admin)
router.post(
  '/portada',
  autenticar,
  upload.single('archivo'),
  validate(subirArchivoSchema),
  archivosController.subir
);

// POST comprobante_pago — público (lo sube el participante sin cuenta)
router.post(
  '/comprobante',
  upload.single('archivo'),
  validate(subirArchivoSchema),
  archivosController.subir
);

router.get('/:id', validate(idParamSchema), archivosController.obtener);
router.delete('/:id', autenticar, validate(idParamSchema), archivosController.eliminar);

module.exports = router;