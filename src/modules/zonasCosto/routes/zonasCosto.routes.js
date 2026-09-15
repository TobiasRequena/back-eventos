const express = require('express');
const router = express.Router({ mergeParams: true });

const zonasCostoController = require('../controllers/zonasCosto.controller');
const validate = require('../../../middlewares/validate');
const autenticar = require('../../../middlewares/autenticar');
const resolverOrganizacionActiva = require('../../../middlewares/resolverOrganizacionActiva');
const {
  crearZonaCostoSchema,
  editarZonaCostoSchema,
  idParamsSchema,
} = require('../schemas/zonasCosto.schema');

router.use(autenticar);
router.use(resolverOrganizacionActiva);

// Todas las rutas viven bajo /eventos/:eventoId/zonas-costo
router.get('/:eventoId/zonas-costo', zonasCostoController.listar);
router.post('/:eventoId/zonas-costo', validate(crearZonaCostoSchema), zonasCostoController.crear);
router.patch('/:eventoId/zonas-costo/:zonaId', validate(editarZonaCostoSchema), zonasCostoController.editar);
router.delete('/:eventoId/zonas-costo/:zonaId', validate(idParamsSchema), zonasCostoController.eliminar);

module.exports = router;
