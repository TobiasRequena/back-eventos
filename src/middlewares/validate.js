function validate(schema) {
  return (req, res, next) => {
    try {
      const resultado = schema.safeParse({
        body: req.body,
        params: req.params,
        query: req.query,
      });

      if (!resultado.success) {
        const errores = resultado.error?.errors?.map((e) => ({
          campo: e.path.join('.'),
          mensaje: e.message,
        })) ?? [];
        return res.status(400).json({ error: { message: 'Error de validación', detalles: errores } });
      }

      req.body = resultado.data.body ?? req.body;
      req.params = resultado.data.params ?? req.params;
      req.query = resultado.data.query ?? req.query;

      next();
    } catch (err) {
      // Si Zod tira una excepción inesperada, la capturamos y la mandamos
      // al errorHandler en lugar de crashear el proceso
      next(err);
    }
  };
}

module.exports = validate;