const adminService = require('../services/admin.service');

async function stats(req, res, next) {
  try {
    const { desde, hasta } = req.query;

    if (!desde || !hasta) {
      return res.status(400).json({ error: { message: 'Falta desde o hasta en los query params' } });
    }

    // Días completos en hora argentina, sin depender de la zona horaria del server
    const fechaDesde = new Date(`${desde}T00:00:00-03:00`);
    const fechaHasta = new Date(`${hasta}T23:59:59.999-03:00`);

    if (isNaN(fechaDesde) || isNaN(fechaHasta)) {
      return res.status(400).json({ error: { message: 'Formato de fecha inválido. Usá YYYY-MM-DD' } });
    }

    const resultado = await adminService.obtenerStats(fechaDesde, fechaHasta);
    res.status(200).json(resultado);
  } catch (error) {
    next(error);
  }
}

module.exports = { stats };