const express = require('express');

const acreditacionController = require('../controllers/acreditacion.controller');
const validate = require('../../../middlewares/validate');
const autenticar = require('../../../middlewares/autenticar');
const resolverOrganizacionActiva = require('../../../middlewares/resolverOrganizacionActiva');
const {
  crearSesionSchema,
  escanearQrSchema,
  checkinGrupalSchema,
} = require('../schemas/acreditacion.schema');
const verificarPagoEvento = require('../../../middlewares/verificarPagoEvento');
const verificarPagoPendiente = require('../../../middlewares/verificarPagoPendiente');

// Router público — escanear QR no requiere auth (lo usa el acreditador en el celular)
const routerPublico = express.Router();
routerPublico.use(verificarPagoPendiente);
routerPublico.get('/escanear', acreditacionController.escanearQr);
routerPublico.post('/sesion', validate(crearSesionSchema), acreditacionController.crearSesion);

// Acreditar — público porque el acreditador no tiene cuenta,
// pero validamos que la sesión exista en el service
const routerAcciones = express.Router();
routerAcciones.use(verificarPagoPendiente);
routerAcciones.post('/individual', acreditacionController.acreditarIndividual);
routerAcciones.post('/grupal', validate(checkinGrupalSchema), acreditacionController.acreditarGrupal);

const routerAdmin = express.Router();
routerAdmin.use(autenticar);
routerAdmin.use(resolverOrganizacionActiva);
routerAdmin.get('/acreditadores', acreditacionController.listarAcreditadores);

module.exports = { routerPublico, routerAcciones, routerAdmin };