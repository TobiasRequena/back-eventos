const express = require('express');

const participantesController = require('../controllers/participantes.controller');
const validate = require('../../../middlewares/validate');
const autenticar = require('../../../middlewares/autenticar');
const autenticarAdminOReferente = require('../../../middlewares/autenticarAdminOReferente');
const resolverOrganizacionActiva = require('../../../middlewares/resolverOrganizacionActiva');
const {
  crearParticipanteSchema,
  editarParticipanteSchema,
  idParamSchema,
  actualizarEstadoVinculoSchema,
} = require('../schemas/participantes.schema');
const { reenviarMailSchema } = require('../schemas/participantes.schema');

// Router anidado: GET /eventos/:eventoId/participantes (requiere auth)
const routerAnidado = express.Router({ mergeParams: true });
routerAnidado.use(autenticar);
routerAnidado.use(resolverOrganizacionActiva);
routerAnidado.get('/:eventoId/participantes', participantesController.listar);

// Router público: solo POST / (inscripción externa, sin auth)
const routerPublico = express.Router();
routerPublico.post(
  '/',
  validate(crearParticipanteSchema),
  participantesController.crear
);

// Router mixto: acepta admin (con X-Org-Id) O referente (sin X-Org-Id)
const routerMixto = express.Router();
routerMixto.patch(
  '/:id/vinculo',
  autenticarAdminOReferente,
  validate(actualizarEstadoVinculoSchema),
  participantesController.actualizarEstadoVinculo
);

// Router plano: resto de operaciones (requieren auth)
const routerPlano = express.Router();
routerPlano.use(autenticar);
routerPlano.use(resolverOrganizacionActiva);
routerPlano.get('/:id', validate(idParamSchema), participantesController.obtener);
routerPlano.patch('/:id', validate(editarParticipanteSchema), participantesController.editar);
routerPlano.delete('/:id', validate(idParamSchema), participantesController.eliminar);
routerPlano.get(
  '/:id/ultima-ubicacion',
  validate(idParamSchema),
  participantesController.obtenerUltimaUbicacion
);
routerPlano.get('/:id/comprobante', validate(idParamSchema), participantesController.obtenerComprobante);
routerPlano.post(
  '/:id/reenviar-mail',
  validate(reenviarMailSchema),
  participantesController.reenviarMail
);
module.exports = { routerAnidado, routerPublico, routerPlano, routerMixto };