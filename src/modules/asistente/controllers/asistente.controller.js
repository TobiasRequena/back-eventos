const asistenteService = require('../services/asistente.service');
const asistenteRepository = require('../repositories/asistente.repository');

async function chat(req, res, next) {
  try {
    const { mensajes, borrador } = req.body;
    res.status(200).json(await asistenteService.chat(mensajes, borrador, req.usuario));
  } catch (error) {
    next(error);
  }
}

async function obtenerBorrador(req, res, next) {
  try {
    const fila = await asistenteRepository.obtenerBorrador(req.usuario.sub);
    res.status(200).json({ borrador: fila?.borrador ?? null, mensajes: fila?.mensajes ?? [] });
  } catch (error) {
    next(error);
  }
}

async function guardarBorrador(req, res, next) {
  try {
    await asistenteRepository.guardarBorrador(req.usuario.sub, req.body);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

async function borrarBorrador(req, res, next) {
  try {
    await asistenteRepository.borrarBorrador(req.usuario.sub);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

module.exports = { chat, obtenerBorrador, guardarBorrador, borrarBorrador };
