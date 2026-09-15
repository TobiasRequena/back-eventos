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

const notificarAusentesSchema = z.object({
  params: z.object({
    eventoId: z.string().uuid(),
  }),
  body: z.object({
    participanteIds: z.array(z.string().uuid()).min(1, 'Debe incluir al menos un participante'),
    mensaje: z.string().min(1, 'El mensaje es obligatorio').max(2000),
  }),
});

module.exports = { enviarComunicacionSchema, listarComunicacionesSchema, notificarAusentesSchema };