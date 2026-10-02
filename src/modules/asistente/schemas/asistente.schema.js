const { z } = require('zod');

const mensajesSchema = z
  .array(
    z.discriminatedUnion('role', [
      z.object({ role: z.literal('user'), content: z.string().trim().min(1).max(2000) }),
      z.object({ role: z.literal('assistant'), content: z.string().max(8000) }),
    ])
  )
  .max(40);

// Forma de VALORES_INICIALES del front; lo valida el formulario al crear el evento
const borradorSchema = z
  .record(z.string(), z.any())
  .refine((b) => JSON.stringify(b).length <= 20000, 'Borrador demasiado grande');

const chatSchema = z.object({
  body: z.object({
    mensajes: mensajesSchema
      .min(1)
      .refine((m) => m.at(-1)?.role === 'user', 'El último mensaje tiene que ser del usuario'),
    borrador: borradorSchema.default({}),
  }),
});

const guardarBorradorSchema = z.object({
  body: z.object({ borrador: borradorSchema, mensajes: mensajesSchema.default([]) }),
});

module.exports = { chatSchema, guardarBorradorSchema };
