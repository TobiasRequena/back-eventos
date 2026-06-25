const express = require('express');
const router = express.Router();

const organizacionesController = require('../controllers/organizaciones.controller');
const validate = require('../../../middlewares/validate');
const autenticar = require('../../../middlewares/autenticar');
const requerirRol = require('../../../middlewares/requerirRol');
const verificarPertenenciaOrganizacion = require('../../../middlewares/verificarPertenenciaOrganizacion');
const {
  completarOrganizacionSchema,
  invitarMiembroSchema,
  quitarMiembroSchema,
} = require('../schemas/organizaciones.schema');

router.use(autenticar);

router.get('/', organizacionesController.listarMias);

// A partir de acá, todas las rutas tienen :id de organización en la URL,
// así que aplicamos la verificación de pertenencia antes del controller.
router.patch(
  '/:id',
  verificarPertenenciaOrganizacion(),
  validate(completarOrganizacionSchema),
  organizacionesController.completar
);

router.get(
  '/:id/miembros',
  verificarPertenenciaOrganizacion(),
  organizacionesController.listarMiembros
);

router.post(
  '/:id/miembros',
  verificarPertenenciaOrganizacion(),
  requerirRol('admin'),
  validate(invitarMiembroSchema),
  organizacionesController.invitarMiembro
);

router.delete(
  '/:id/miembros/:usuarioId',
  verificarPertenenciaOrganizacion(),
  requerirRol('admin'),
  validate(quitarMiembroSchema),
  organizacionesController.quitarMiembro
);

module.exports = router;