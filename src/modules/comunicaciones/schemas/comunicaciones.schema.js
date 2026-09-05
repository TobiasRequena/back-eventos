const { z } = require('zod');

const enviarComunicacionSchema = z.object({
  params: z.object({
    eventoId: z.string().uuid(),
  }),
  body: z.object({
    asunto: z.string().min(1).max(200),
    mensaje: z.string().min(1),
    destinatarios: z.enum(['inscriptos', 'acreditados', 'referentes']),
    filtros: z.array(z.object({
      campo_form_id: z.string().uuid(),
      valor: z.string(),
    })).optional(),
  }),
});

const listarComunicacionesSchema = z.object({
  params: z.object({
    eventoId: z.string().uuid(),
  }),
});

module.exports = { enviarComunicacionSchema, listarComunicacionesSchema };