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

// Router público — escanear QR no requiere auth (lo usa el acreditador en el celular)
const routerPublico = express.Router();
routerPublico.get('/escanear', acreditacionController.escanearQr);
routerPublico.post('/sesion', validate(crearSesionSchema), acreditacionController.crearSesion);

// Acreditar — público porque el acreditador no tiene cuenta,
// pero validamos que la sesión exista en el service
const routerAcciones = express.Router();
routerAcciones.post('/individual', acreditacionController.acreditarIndividual);
routerAcciones.post('/grupal', validate(checkinGrupalSchema), acreditacionController.acreditarGrupal);

module.exports = { routerPublico, routerAcciones };