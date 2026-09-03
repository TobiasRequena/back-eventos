const express = require('express');
const router = express.Router();

const eventosController = require('../controllers/eventos.controller');
const validate = require('../../../middlewares/validate');
const autenticar = require('../../../middlewares/autenticar');
const resolverOrganizacionActiva = require('../../../middlewares/resolverOrganizacionActiva');
const {
  crearEventoSchema,
  editarEventoSchema,
  idParamSchema,
  buscarPorCodigoSchema,
} = require('../schemas/eventos.schema');
const verificarPagoPendiente = require('../../../middlewares/verificarPagoPendiente');

router.get(
  '/codigo/:codigo',
  validate(buscarPorCodigoSchema),
  eventosController.buscarPorCodigo
);

router.use(autenticar);

router.get(
  '/codigo/:codigo/disponible',
  validate(buscarPorCodigoSchema),
  eventosController.verificarDisponibilidadCodigo
);

router.use(resolverOrganizacionActiva);

router.post('/', validate(crearEventoSchema), eventosController.crear);
router.get('/', eventosController.listar);
router.get('/stats/inscripciones', eventosController.statsInscripciones);
router.get('/:id', validate(idParamSchema), eventosController.obtener);
router.patch('/:id', validate(editarEventoSchema), verificarPagoPendiente, eventosController.editar);
router.delete('/:id', validate(idParamSchema), verificarPagoPendiente, eventosController.eliminar);
router.get('/:id/stats', autenticar, resolverOrganizacionActiva, verificarPagoPendiente, eventosController.stats);
router.get('/:id/inscriptos/excel', validate(idParamSchema), eventosController.descargarExcel);
router.get('/:id/participantes/pendientes-pago', autenticar, resolverOrganizacionActiva, verificarPagoPendiente, eventosController.listarPendientesPago);
router.get('/:id/fichas-medicas', autenticar, resolverOrganizacionActiva, verificarPagoPendiente, eventosController.listarFichasMedicas);

module.exports = router;