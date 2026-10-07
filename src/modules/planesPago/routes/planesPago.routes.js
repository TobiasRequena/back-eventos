const express = require('express');
const router = express.Router({ mergeParams: true });

const planesPagoController = require('../controllers/planesPago.controller');
const validate = require('../../../middlewares/validate');
const autenticar = require('../../../middlewares/autenticar');
const resolverOrganizacionActiva = require('../../../middlewares/resolverOrganizacionActiva');
const { reemplazarPlanesSchema } = require('../schemas/planesPago.schema');

// Los planes se leen junto con el evento (detalle admin y por código público).
// Acá solo se guardan: PUT reemplaza todos los planes del evento.
router.put(
  '/:eventoId/planes-pago',
  autenticar,
  resolverOrganizacionActiva,
  validate(reemplazarPlanesSchema),
  planesPagoController.reemplazar
);

module.exports = router;
