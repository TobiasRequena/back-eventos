const express = require('express');

const talleresController = require('../controllers/talleres.controller');
const validate = require('../../../middlewares/validate');
const autenticar = require('../../../middlewares/autenticar');
const resolverOrganizacionActiva = require('../../../middlewares/resolverOrganizacionActiva');
const {
  crearBloqueTallerSchema,
  editarBloqueTallerSchema,
  crearTallerEnBloqueSchema,
  editarTallerSchema,
  idParamSchema,
  asignarParticipanteSchema,
  desasignarParticipanteSchema,
} = require('../schemas/talleres.schema');

// Router anidado en /eventos/:eventoId/bloques-taller — crear y listar bloques de un evento.
const routerBloquesAnidado = express.Router({ mergeParams: true });
routerBloquesAnidado.use(autenticar);
routerBloquesAnidado.use(resolverOrganizacionActiva);
routerBloquesAnidado.post(
  '/:eventoId/bloques-taller',
  validate(crearBloqueTallerSchema),
  talleresController.crearBloque
);
routerBloquesAnidado.get('/:eventoId/bloques-taller', talleresController.listarBloques);

// Router anidado en /bloques-taller/:bloqueId/talleres — agregar un taller suelto a un bloque existente.
const routerTalleresEnBloque = express.Router({ mergeParams: true });
routerTalleresEnBloque.use(autenticar);
routerTalleresEnBloque.use(resolverOrganizacionActiva);
routerTalleresEnBloque.post(
  '/:bloqueId/talleres',
  validate(crearTallerEnBloqueSchema),
  talleresController.crearTallerEnBloque
);

// Router plano en /bloques-taller/:id — operaciones puntuales sobre un bloque.
const routerBloquesPlano = express.Router();
routerBloquesPlano.use(autenticar);
routerBloquesPlano.use(resolverOrganizacionActiva);
routerBloquesPlano.get('/:id', validate(idParamSchema), talleresController.obtenerBloque);
routerBloquesPlano.patch('/:id', validate(editarBloqueTallerSchema), talleresController.editarBloque);
routerBloquesPlano.delete('/:id', validate(idParamSchema), talleresController.eliminarBloque);

// Router plano en /talleres/:id — operaciones puntuales sobre un taller.
const routerTalleresPlano = express.Router();
routerTalleresPlano.use(autenticar);
routerTalleresPlano.use(resolverOrganizacionActiva);
routerTalleresPlano.get('/:id', validate(idParamSchema), talleresController.obtenerTaller);
routerTalleresPlano.patch('/:id', validate(editarTallerSchema), talleresController.editarTaller);
routerTalleresPlano.delete('/:id', validate(idParamSchema), talleresController.eliminarTaller);
routerTalleresPlano.get('/:id/inscriptos/count', validate(idParamSchema), talleresController.contarInscriptos);
routerTalleresPlano.get('/:id/inscriptos', validate(idParamSchema), talleresController.listarInscriptos);
routerTalleresPlano.post(
  '/:id/inscriptos',
  validate(asignarParticipanteSchema),
  talleresController.asignarParticipante
);
routerTalleresPlano.delete(
  '/:id/inscriptos/:participanteId',
  validate(desasignarParticipanteSchema),
  talleresController.desasignarParticipante
);

module.exports = {
  routerBloquesAnidado,
  routerTalleresEnBloque,
  routerBloquesPlano,
  routerTalleresPlano,
};