const express = require('express');
const router = express.Router({ mergeParams: true });

const formulariosController = require('../controllers/formularios.controller');
const validate = require('../../../middlewares/validate');
const autenticar = require('../../../middlewares/autenticar');
const resolverOrganizacionActiva = require('../../../middlewares/resolverOrganizacionActiva');
const {
  editarCampoSchema,
  reordenarCamposSchema,
} = require('../schemas/formularios.schema');

router.use(autenticar);
router.use(resolverOrganizacionActiva);

// Todas las rutas viven bajo /eventos/:eventoId/campos-form.
// No hay POST ni DELETE: los campos se crean con el evento y la baja es lógica (PATCH activo).
router.get('/:eventoId/campos-form', formulariosController.listar);
router.patch('/:eventoId/campos-form/orden', validate(reordenarCamposSchema), formulariosController.reordenar);
router.patch('/:eventoId/campos-form/:campoId', validate(editarCampoSchema), formulariosController.editar);

module.exports = router;