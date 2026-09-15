const { z } = require('zod');

// Reutilizado también desde eventos.schema (zonasCosto se puede mandar
// junto con el resto del evento al crearlo, igual que camposForm).
const zonaCostoItemSchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio').max(100),
  costo: z.number().positive('El costo debe ser mayor a 0'),
  orden: z.number().int().nonnegative().default(0),
});

const crearZonaCostoSchema = z.object({
  params: z.object({
    eventoId: z.string().uuid('Id de evento inválido'),
  }),
  body: zonaCostoItemSchema,
});

const editarZonaCostoSchema = z.object({
  params: z.object({
    eventoId: z.string().uuid('Id de evento inválido'),
    zonaId: z.string().uuid('Id de zona inválido'),
  }),
  body: z.object({
    nombre: z.string().min(1).max(100).optional(),
    costo: z.number().positive('El costo debe ser mayor a 0').optional(),
    orden: z.number().int().nonnegative().optional(),
  }),
});

const idParamsSchema = z.object({
  params: z.object({
    eventoId: z.string().uuid('Id de evento inválido'),
    zonaId: z.string().uuid('Id de zona inválido'),
  }),
});

module.exports = {
  zonaCostoItemSchema,
  crearZonaCostoSchema,
  editarZonaCostoSchema,
  idParamsSchema,
};
