const express = require('express');
const router = express.Router({ mergeParams: true });

const controller = require('../controllers/gruposTrabajo.controller');
const validate = require('../../../middlewares/validate');
const autenticar = require('../../../middlewares/autenticar');
const resolverOrganizacionActiva = require('../../../middlewares/resolverOrganizacionActiva');
const {
  crearEsquemaSchema, editarEsquemaSchema,
  crearTandaSchema, editarTandaSchema, reordenarTandasSchema,
  excluirParticipantesSchema, asignarAGrupoSchema,
  esquemaIdParamSchema, eventoIdParamSchema, grupoIdParamSchema,
} = require('../schemas/gruposTrabajo.schema');
const { quitarExcluidoSchema } = require('../schemas/gruposTrabajo.schema');
const { quitarDeGrupoSchema } = require('../schemas/gruposTrabajo.schema');
const verificarPagoEvento = require('../../../middlewares/verificarPagoEvento');

// Todos los endpoints requieren auth
router.use(autenticar);
router.use(resolverOrganizacionActiva);

// ─── PRESETS (sin :esquemaId) ────────────────────────────────────────────────
router.get('/nombres-presets', controller.obtenerPresets);

// ─── ESQUEMAS ────────────────────────────────────────────────────────────────
router.get('/', validate(eventoIdParamSchema), controller.listarEsquemas);
router.post('/', validate(crearEsquemaSchema), controller.crearEsquema);
router.get('/:esquemaId', validate(esquemaIdParamSchema), controller.obtenerEsquema);
router.patch('/:esquemaId', validate(editarEsquemaSchema), controller.editarEsquema);
router.delete('/:esquemaId', validate(esquemaIdParamSchema), controller.eliminarEsquema);

// ─── TANDAS ──────────────────────────────────────────────────────────────────
router.post('/:esquemaId/tandas', validate(crearTandaSchema), controller.crearTanda);
router.patch('/:esquemaId/tandas/reordenar', validate(reordenarTandasSchema), controller.reordenarTandas);
router.patch('/:esquemaId/tandas/:tandaId', validate(editarTandaSchema), controller.editarTanda);
router.delete('/:esquemaId/tandas/:tandaId', validate(esquemaIdParamSchema), controller.eliminarTanda);

// ─── EXCLUIDOS ───────────────────────────────────────────────────────────────
router.post('/:esquemaId/excluidos', validate(excluirParticipantesSchema), controller.excluirParticipantes);
router.delete('/:esquemaId/excluidos/:participanteId', validate(quitarExcluidoSchema), controller.quitarExcluido);

// ─── PREVIEW Y GENERACIÓN ────────────────────────────────────────────────────
router.get('/:esquemaId/preview', validate(esquemaIdParamSchema), controller.preview);
router.post('/:esquemaId/generar', verificarPagoEvento(24), validate(esquemaIdParamSchema), controller.generar);
router.get(
  '/:esquemaId/excel',
  autenticar,
  resolverOrganizacionActiva,
  validate(esquemaIdParamSchema),
  controller.descargarExcelGrupos
);
router.get(
  '/:esquemaId/grupos/:grupoId/excel',
  autenticar,
  resolverOrganizacionActiva,
  validate(grupoIdParamSchema),
  controller.descargarExcelGrupoIndividual
);

// ─── GRUPOS Y PENDIENTES ─────────────────────────────────────────────────────
router.get('/:esquemaId/grupos', validate(esquemaIdParamSchema), controller.listarGrupos);
router.get('/:esquemaId/pendientes', validate(esquemaIdParamSchema), controller.listarPendientes);
router.patch('/:esquemaId/grupos/:grupoId/agregar', validate(asignarAGrupoSchema), controller.asignarAGrupo);
router.patch('/:esquemaId/grupos/:grupoId/quitar/:participanteId', validate(quitarDeGrupoSchema), controller.quitarDeGrupo);

// ─── MAIL ─────────────────────────────────────────────────────────────────
router.post(
  '/:esquemaId/notificar',
  autenticar,
  resolverOrganizacionActiva,
  validate(esquemaIdParamSchema),
  controller.enviarMailAsignacionMasivo
);

router.post(
  '/:esquemaId/notificar/:participanteId',
  autenticar,
  resolverOrganizacionActiva,
  validate(quitarExcluidoSchema),
  controller.enviarMailAsignacion
);

module.exports = router;