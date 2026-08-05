const adminService = require('../services/admin.service');

async function stats(req, res, next) {
  try {
    const { desde, hasta } = req.query;

    if (!desde || !hasta) {
      return res.status(400).json({ error: { message: 'Falta desde o hasta en los query params' } });
    }

    const fechaDesde = new Date(desde);
    const fechaHasta = new Date(hasta);
    fechaHasta.setHours(23, 59, 59, 999);

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