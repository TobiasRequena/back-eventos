const acreditacionService = require('../services/acreditacion.service');

async function crearSesion(req, res, next) {
  try {
    // req.orgId puede ser undefined si viene sin auth
    const sesion = await acreditacionService.crearSesion(req.orgId ?? null, req.body);
    res.status(201).json({ sesion });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/acreditacion/escanear?qr=:qrPersonal&eventoId=:eventoId
 * Público — el acreditador no tiene cuenta, solo tiene la sesión.
 */
async function escanearQr(req, res, next) {
  try {
    const { qr, eventoId } = req.query;
    if (!qr || !eventoId) {
      return res.status(400).json({ error: { message: 'Falta qr o eventoId' } });
    }
    const resultado = await acreditacionService.escanearQr(qr, eventoId);
    res.status(200).json(resultado);
  } catch (error) {
    next(error);
  }
}

async function acreditarIndividual(req, res, next) {
  try {
    const { participanteId, acreditadorId, puntoAccesoId } = req.body;
    const checkin = await acreditacionService.acreditarIndividual(
      participanteId,
      acreditadorId,
      req.orgId,
      puntoAccesoId
    );
    res.status(201).json({ checkin });
  } catch (error) {
    next(error);
  }
}

async function acreditarGrupal(req, res, next) {
  try {
    const { participanteIds, acreditadorId, puntoAccesoId, eventoId } = req.body;
    const resultados = await acreditacionService.acreditarGrupal(
      participanteIds,
      acreditadorId,
      req.orgId,
      puntoAccesoId,
      eventoId
    );
    res.status(200).json({ resultados });
  } catch (error) {
    next(error);
  }
}

module.exports = { crearSesion, escanearQr, acreditarIndividual, acreditarGrupal };