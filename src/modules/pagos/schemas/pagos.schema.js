const { z } = require('zod');

const pagarTramoAdelanteSchema = z.object({
  params: z.object({
    eventoId: z.string().uuid('Id de evento inválido'),
  }),
  body: z.object({
    participantesObjetivo: z.number().int().positive('Debe ser un número positivo'),
  }),
});

const eventoIdParamSchema = z.object({
  params: z.object({
    eventoId: z.string().uuid('Id de evento inválido'),
  }),
});

const revisarCuotaSchema = z.object({
  params: z.object({ pagoId: z.string().uuid('Id de cuota inválido') }),
  body: z.object({ estado: z.enum(['aprobado', 'rechazado']) }),
});

module.exports = {
  revisarCuotaSchema,
  pagarTramoAdelanteSchema,
  eventoIdParamSchema
};