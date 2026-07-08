const express = require('express');

const gruposController = require('../controllers/grupos.controller');
const validate = require('../../../middlewares/validate');
const autenticar = require('../../../middlewares/autenticar');
const resolverOrganizacionActiva = require('../../../middlewares/resolverOrganizacionActiva');
const {
  crearGrupoSchema,
  editarGrupoSchema,
  idParamSchema,
  codigoParamSchema,
} = require('../schemas/grupos.schema');

// Endpoint público — resuelve el código de invitación sin necesitar auth
// Va ANTES de los middlewares de autenticación
const routerPublico = express.Router();
routerPublico.get(
  '/invitacion/:codigoInv',
  validate(codigoParamSchema),
  gruposController.resolverInvitacion
);

// Router anidado: GET /eventos/:eventoId/grupos
const routerAnidado = express.Router({ mergeParams: true });
routerAnidado.use(autenticar);
routerAnidado.use(resolverOrganizacionActiva);
routerAnidado.get('/:eventoId/grupos', gruposController.listar);

// Router plano: el resto de operaciones sobre /grupos
const routerPlano = express.Router();
routerPlano.use(autenticar);
routerPlano.use(resolverOrganizacionActiva);
routerPlano.post('/', validate(crearGrupoSchema), gruposController.crear);
routerPlano.get('/:id', validate(idParamSchema), gruposController.obtener);
routerPlano.patch('/:id', validate(editarGrupoSchema), gruposController.editar);
routerPlano.delete('/:id', validate(idParamSchema), gruposController.eliminar);
routerPlano.get('/:id/integrantes', validate(idParamSchema), gruposController.listarIntegrantes);
routerPlano.get('/:id/solicitudes', validate(idParamSchema), gruposController.listarSolicitudes);

module.exports = { routerPublico, routerAnidado, routerPlano };