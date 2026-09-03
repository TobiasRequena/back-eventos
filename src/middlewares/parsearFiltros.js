function parsearFiltros(req, res, next) {
  if (!req.body.filtros) {
    return next();
  }

  try {
    req.body.filtros = JSON.parse(req.body.filtros);
    next();
  } catch (error) {
    return res.status(400).json({
      error: {
        message: 'El campo filtros debe ser un JSON válido',
      },
    });
  }
}

module.exports = parsearFiltros;