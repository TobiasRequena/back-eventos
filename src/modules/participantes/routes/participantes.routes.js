const express = require('express');

const participantesController = require('../controllers/participantes.controller');
const validate = require('../../../middlewares/validate');
const autenticar = require('../../../middlewares/autenticar');
const resolverOrganizacionActiva = require('../../../middlewares/resolverOrganizacionActiva');
const {
  crearParticipanteSchema,
  editarParticipanteSchema,
  idParamSchema,
  actualizarEstadoVinculoSchema,
} = require('../schemas/participantes.schema');

// Router anidado: GET /eventos/:eventoId/participantes
const routerAnidado = express.Router({ mergeParams: true });
routerAnidado.use(autenticar);
routerAnidado.use(resolverOrganizacionActiva);
routerAnidado.get('/:eventoId/participantes', participantesController.listar);

// Router plano: el resto de operaciones sobre /participantes
const routerPlano = express.Router();
routerPlano.use(autenticar);
routerPlano.use(resolverOrganizacionActiva);

routerPlano.post(
  '/',
  validate(crearParticipanteSchema),
  participantesController.crear
);

routerPlano.get('/:id', validate(idParamSchema), participantesController.obtener);

routerPlano.patch(
  '/:id',
  validate(editarParticipanteSchema),
  participantesController.editar
);

routerPlano.delete('/:id', validate(idParamSchema), participantesController.eliminar);

routerPlano.patch(
  '/:id/vinculo',
  validate(actualizarEstadoVinculoSchema),
  participantesController.actualizarEstadoVinculo
);

routerPlano.get(
  '/:id/ultima-ubicacion',
  validate(idParamSchema),
  participantesController.obtenerUltimaUbicacion
);

module.exports = { routerAnidado, routerPlano };