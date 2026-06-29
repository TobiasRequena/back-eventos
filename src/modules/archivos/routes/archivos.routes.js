const express = require('express');
const router = express.Router();

const archivosController = require('../controllers/archivos.controller');
const validate = require('../../../middlewares/validate');
const autenticar = require('../../../middlewares/autenticar');
const upload = require('../../../middlewares/upload');
const { subirArchivoSchema, idParamSchema } = require('../schemas/archivos.schema');

// POST requiere autenticación para subir portada de evento (lo hace un Admin).
// El día que se implemente "comprobante subido por participante sin cuenta",
// vamos a necesitar otra ruta pública separada — por ahora, todo pasa por acá autenticado.
router.post(
  '/',
  autenticar,
  upload.single('archivo'),
  validate(subirArchivoSchema),
  archivosController.subir
);

router.get('/:id', validate(idParamSchema), archivosController.obtener);
router.delete('/:id', autenticar, validate(idParamSchema), archivosController.eliminar);

module.exports = router;