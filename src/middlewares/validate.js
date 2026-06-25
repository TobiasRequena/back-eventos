function validate(schema) {
  return (req, res, next) => {
    const resultado = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query,
    });

    if (!resultado.success) {
      const errores = resultado.error.errors.map((e) => ({
        campo: e.path.join('.'),
        mensaje: e.message,
      }));
      return res.status(400).json({ error: { message: 'Error de validación', detalles: errores } });
    }

    // Sobrescribimos con los datos ya parseados/tipados por Zod
    req.body = resultado.data.body ?? req.body;
    req.params = resultado.data.params ?? req.params;
    req.query = resultado.data.query ?? req.query;

    next();
  };
}

module.exports = validate;