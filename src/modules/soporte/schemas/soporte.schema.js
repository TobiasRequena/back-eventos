const { z } = require('zod');

const contactoSchema = z.object({
  body: z.object({
    nombre: z.string().min(1).max(150),
    email: z.string().email('Email inválido'),
    asunto: z.string().min(1).max(200),
    mensaje: z.string().min(10).max(2000),
  }),
});

module.exports = { contactoSchema };