const express = require('express');

const talleresController = require('../controllers/talleres.controller');
const validate = require('../../../middlewares/validate');
const autenticar = require('../../../middlewares/autenticar');
const resolverOrganizacionActiva = require('../../../middlewares/resolverOrganizacionActiva');
const {
  crearTallerSchema,
  editarTallerSchema,
  idParamSchema,
  asignarParticipanteSchema,
  desasignarParticipanteSchema,
} = require('../schemas/talleres.schema');

// Router anidado: se monta en app.js bajo /api/v1/eventos
const routerAnidado = express.Router({ mergeParams: true });
routerAnidado.use(autenticar);
routerAnidado.use(resolverOrganizacionActiva);
routerAnidado.post(
  '/:eventoId/talleres',
  validate(crearTallerSchema),
  talleresController.crear
);
routerAnidado.get(
  '/:eventoId/talleres',
  talleresController.listar
);

// Router plano: se monta en app.js bajo /api/v1/talleres
const routerPlano = express.Router();
routerPlano.use(autenticar);
routerPlano.use(resolverOrganizacionActiva);
routerPlano.get('/:id', validate(idParamSchema), talleresController.obtener);
routerPlano.patch('/:id', validate(editarTallerSchema), talleresController.editar);
routerPlano.delete('/:id', validate(idParamSchema), talleresController.eliminar);
routerPlano.get('/:id/inscriptos', validate(idParamSchema), talleresController.listarInscriptos);
routerPlano.post(
  '/:id/inscriptos',
  validate(asignarParticipanteSchema),
  talleresController.asignarParticipante
);
routerPlano.delete(
  '/:id/inscriptos/:participanteId',
  validate(desasignarParticipanteSchema),
  talleresController.desasignarParticipante
);

module.exports = { routerAnidado, routerPlano };