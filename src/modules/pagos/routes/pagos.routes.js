const express = require('express');
const router = express.Router();
const pagosController = require('../controllers/pagos.controller');
const validate = require('../../../middlewares/validate');
const autenticar = require('../../../middlewares/autenticar');
const resolverOrganizacionActiva = require('../../../middlewares/resolverOrganizacionActiva');
const { limiterPublico } = require('../../../middlewares/rateLimit');
const { pagarTramoAdelanteSchema, eventoIdParamSchema } = require('../schemas/pagos.schema');

// Webhook público
router.post('/webhook/galiopay', pagosController.webhookGaliopay);

// Rutas protegidas
router.post(
  '/eventos/:eventoId/reenviar-mail',
  autenticar,
  resolverOrganizacionActiva,
  validate(eventoIdParamSchema),
  pagosController.reenviarMailPago
);

router.post(
  '/eventos/:eventoId/tramo-adelantado',
  autenticar,
  resolverOrganizacionActiva,
  validate(pagarTramoAdelanteSchema),
  pagosController.pagarTramoAdelantado
);

// Público: precios de la plataforma, los muestra la landing
router.get('/tramos', limiterPublico, pagosController.listarTramos);

router.get(
  '/eventos/:eventoId/historial',
  autenticar,
  resolverOrganizacionActiva,
  validate(eventoIdParamSchema),
  pagosController.listarPagosEvento
);

router.get('/eventos-activos', autenticar, resolverOrganizacionActiva, pagosController.listarEventosActivos);
router.get('/historial', autenticar, resolverOrganizacionActiva, pagosController.listarHistorial);

module.exports = router;