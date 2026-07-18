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

// IMPORTANTE: esta ruta pública va ANTES de aplicar autenticar/resolverOrganizacionActiva,
// porque no requiere sesión — cualquier persona buscando un evento para inscribirse
// debe poder usarla sin estar logueada.
router.get(
  '/codigo/:codigo',
  validate(buscarPorCodigoSchema),
  eventosController.buscarPorCodigo
);

// A partir de acá, todo requiere estar logueado.
router.use(autenticar);

// Requiere token pero NO requiere X-Org-Id — la disponibilidad de un código
// es global (entre todos los eventos vigentes), no está limitada a una org.
// Va ANTES de resolverOrganizacionActiva y ANTES de /codigo/:codigo para que
// Express no interprete "disponible" como el valor del param :codigo.
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
router.patch('/:id', validate(editarEventoSchema), eventosController.editar);
router.delete('/:id', validate(idParamSchema), eventosController.eliminar);
router.get('/:id/stats', validate(idParamSchema), eventosController.stats);
router.get('/:id/inscriptos/excel', validate(idParamSchema), eventosController.descargarExcel);

module.exports = router;