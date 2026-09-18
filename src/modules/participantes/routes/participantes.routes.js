const express = require('express');
const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
});

const participantesController = require('../controllers/participantes.controller');
const validate = require('../../../middlewares/validate');
const autenticar = require('../../../middlewares/autenticar');
const autenticarAdminOReferente = require('../../../middlewares/autenticarAdminOReferente');
const resolverOrganizacionActiva = require('../../../middlewares/resolverOrganizacionActiva');
const { limiterPublico } = require('../../../middlewares/rateLimit');
const {
  crearParticipanteSchema,
  editarParticipanteSchema,
  idParamSchema,
  actualizarEstadoVinculoSchema,
  listaPdfSchema,
} = require('../schemas/participantes.schema');
const { reenviarMailSchema } = require('../schemas/participantes.schema');
const fichaMedicaController = require('../../fichaMedica/controllers/fichaMedica.controller');
const { crearFichaMedicaSchema } = require('../../fichaMedica/schemas/fichaMedica.schema');
const contactoEmergenciaController = require('../../contactoEmergencia/controllers/contactoEmergencia.controller');
const { actualizarEstadoPagoSchema, actualizarZonaCostoSchema } = require('../schemas/participantes.schema');
const verificarPagoPendiente = require('../../../middlewares/verificarPagoPendiente');

// Router anidado: GET /eventos/:eventoId/participantes (requiere auth)
const routerAnidado = express.Router({ mergeParams: true });
routerAnidado.use(autenticar);
routerAnidado.use(resolverOrganizacionActiva);
routerAnidado.get('/:eventoId/participantes/eliminados', verificarPagoPendiente, participantesController.listarEliminados);
routerAnidado.post(
  '/:eventoId/participantes/lista-pdf',
  validate(listaPdfSchema),
  participantesController.descargarListaPdf
);
routerAnidado.get('/:eventoId/participantes', verificarPagoPendiente, participantesController.listar);

// Router público: inscripción externa y subida de documentación post-inscripción (sin auth obligatoria)
const routerPublico = express.Router();
routerPublico.post('/', limiterPublico, verificarPagoPendiente, validate(crearParticipanteSchema), participantesController.crear);
routerPublico.get('/verificar-dni', limiterPublico, participantesController.verificarDni);
routerPublico.patch('/:id/autorizacion', limiterPublico, upload.single('archivo'), participantesController.subirAutorizacion);
routerPublico.patch('/:id/certificado', limiterPublico, upload.single('archivo'), participantesController.subirCertificado);

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
routerPlano.patch('/:id/autorizacion', upload.single('archivo'), participantesController.subirAutorizacion);
routerPlano.patch('/:id/certificado', upload.single('archivo'), participantesController.subirCertificado);
routerPlano.get('/:id/ficha-medica', autenticar, resolverOrganizacionActiva, fichaMedicaController.obtenerFicha);
routerPlano.patch('/:id/ficha-medica', autenticar, resolverOrganizacionActiva, validate(crearFichaMedicaSchema), fichaMedicaController.guardarFicha);
routerPlano.get('/:id/contacto-emergencia', autenticar, resolverOrganizacionActiva, contactoEmergenciaController.obtenerContacto);
routerPlano.patch(
  '/:id/estado-pago',
  validate(actualizarEstadoPagoSchema),
  participantesController.actualizarEstadoPago
);
routerPlano.patch(
  '/:id/zona-costo',
  validate(actualizarZonaCostoSchema),
  participantesController.actualizarZonaCosto
);

module.exports = { routerAnidado, routerPublico, routerPlano, routerMixto };