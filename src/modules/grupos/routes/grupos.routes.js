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
  loginReferenteSchema
} = require('../schemas/grupos.schema');
const autenticarReferente = require('../../../middlewares/autenticarReferente');

// Router público — sin auth
const routerPublico = express.Router();
routerPublico.get(
  '/invitacion/:codigoInv',
  validate(codigoParamSchema),
  gruposController.resolverInvitacion
);
routerPublico.post(
  '/',
  validate(crearGrupoSchema),
  gruposController.crear
);
routerPublico.post(
  '/panel/login',
  validate(loginReferenteSchema),
  gruposController.loginReferente
);

const routerPanel = express.Router();
routerPanel.get(
  '/:id/panel/integrantes',
  autenticarReferente,
  gruposController.listarIntegrantesReferente
);
routerPanel.get(
  '/:id/panel/solicitudes',
  autenticarReferente,
  gruposController.listarSolicitudesReferente
);

// Router anidado: GET /eventos/:eventoId/grupos (requiere auth)
const routerAnidado = express.Router({ mergeParams: true });
routerAnidado.use(autenticar);
routerAnidado.use(resolverOrganizacionActiva);
routerAnidado.get('/:eventoId/grupos', gruposController.listar);

// Router plano: resto de operaciones (requieren auth)
const routerPlano = express.Router();
routerPlano.use(autenticar);
routerPlano.use(resolverOrganizacionActiva);
routerPlano.get('/:id', validate(idParamSchema), gruposController.obtener);
routerPlano.patch('/:id', validate(editarGrupoSchema), gruposController.editar);
routerPlano.delete('/:id', validate(idParamSchema), gruposController.eliminar);
routerPlano.get('/:id/integrantes', validate(idParamSchema), gruposController.listarIntegrantes);
routerPlano.get('/:id/solicitudes', validate(idParamSchema), gruposController.listarSolicitudes);

module.exports = { routerPublico, routerAnidado, routerPlano, routerPanel };