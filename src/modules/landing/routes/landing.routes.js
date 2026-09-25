const express = require('express');
const jwt = require('jsonwebtoken');

const landingController = require('../controllers/landing.controller');
const validate = require('../../../middlewares/validate');
const autenticar = require('../../../middlewares/autenticar');
const resolverOrganizacionActiva = require('../../../middlewares/resolverOrganizacionActiva');
const upload = require('../../../middlewares/upload');
const { limiterPublico } = require('../../../middlewares/rateLimit');
const {
  sugerenciaSchema,
  meInteresaSchema,
  quitarMeInteresaSchema,
  sincronizarSchema,
  galeriaParamsSchema,
} = require('../schemas/landing.schema');

/**
 * Como autenticar, pero sin sesión (o con un token inválido) sigue de largo
 * como anónimo en vez de cortar con 401.
 */
function autenticarOpcional(req, res, next) {
  const [tipo, token] = (req.headers.authorization ?? '').split(' ');
  if (tipo === 'Bearer' && token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      if (!payload.tipo || payload.tipo === 'admin') req.usuario = payload;
    } catch {
      // token vencido o inválido: se trata como anónimo
    }
  }
  next();
}

// /api/v1/landing — público
const routerPublico = express.Router();

routerPublico.use(limiterPublico);
routerPublico.get('/eventos', landingController.listarEventos);
routerPublico.get('/organizaciones', landingController.listarOrganizaciones);
routerPublico.get('/galeria', landingController.listarGaleria);
routerPublico.post('/sugerencias', validate(sugerenciaSchema), landingController.crearSugerencia);

routerPublico.post('/me-interesa/sincronizar', autenticar, validate(sincronizarSchema), landingController.sincronizarMeInteresa);
routerPublico.post('/me-interesa', autenticarOpcional, validate(meInteresaSchema), landingController.marcarMeInteresa);
routerPublico.delete('/me-interesa/:funcion', autenticarOpcional, validate(quitarMeInteresaSchema), landingController.quitarMeInteresa);

// /api/v1/eventos/:id/galeria — la organización carga las fotos de su evento terminado
const routerGaleria = express.Router();

routerGaleria.use('/:id/galeria', autenticar, resolverOrganizacionActiva);
routerGaleria.get('/:id/galeria', validate(galeriaParamsSchema), landingController.listarFotosEvento);
routerGaleria.post('/:id/galeria', upload.single('archivo'), validate(galeriaParamsSchema), landingController.subirFotoEvento);
routerGaleria.delete('/:id/galeria/:archivoId', validate(galeriaParamsSchema), landingController.eliminarFotoEvento);

module.exports = { routerPublico, routerGaleria };
