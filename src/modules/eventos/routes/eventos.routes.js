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

// A partir de acá, todo requiere estar logueado Y tener una organización activa
// declarada en el header X-Org-Id.
router.use(autenticar);
router.use(resolverOrganizacionActiva);

router.post('/', validate(crearEventoSchema), eventosController.crear);
router.get('/', eventosController.listar);
router.get('/:id', validate(idParamSchema), eventosController.obtener);
router.patch('/:id', validate(editarEventoSchema), eventosController.editar);
router.delete('/:id', validate(idParamSchema), eventosController.eliminar);

module.exports = router;