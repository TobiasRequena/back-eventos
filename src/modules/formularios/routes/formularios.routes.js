const express = require('express');
const router = express.Router({ mergeParams: true });

const formulariosController = require('../controllers/formularios.controller');
const validate = require('../../../middlewares/validate');
const autenticar = require('../../../middlewares/autenticar');
const resolverOrganizacionActiva = require('../../../middlewares/resolverOrganizacionActiva');
const {
  crearCampoSchema,
  editarCampoSchema,
  idParamsSchema,
  reordenarCamposSchema,
} = require('../schemas/formularios.schema');

router.use(autenticar);
router.use(resolverOrganizacionActiva);

// Todas las rutas viven bajo /eventos/:eventoId/campos-form
router.get('/:eventoId/campos-form', formulariosController.listar);
router.post('/:eventoId/campos-form', validate(crearCampoSchema), formulariosController.crear);
router.patch('/:eventoId/campos-form/orden', validate(reordenarCamposSchema), formulariosController.reordenar);
router.patch('/:eventoId/campos-form/:campoId', validate(editarCampoSchema), formulariosController.editar);
router.delete('/:eventoId/campos-form/:campoId', validate(idParamsSchema), formulariosController.eliminar);

module.exports = router;