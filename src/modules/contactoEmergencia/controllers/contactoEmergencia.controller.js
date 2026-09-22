const contactoEmergenciaService = require('../services/contactoEmergencia.service');

async function obtenerContacto(req, res, next) {
  try {
    const contacto = await contactoEmergenciaService.obtenerContacto(req.params.id, req.orgId);
    res.status(200).json({ contacto });
  } catch (error) { next(error); }
}

module.exports = { obtenerContacto };
