const { z } = require('zod');

// Schema de un taller individual, usado tanto standalone (POST /eventos/:id/talleres)
// como embebido en el array `talleres` del POST /eventos.
const tallerSchema = z
  .object({
    nombre: z.string().min(1, 'El nombre del taller es obligatorio').max(150),
    inicio: z.string().datetime({ message: 'inicio debe ser una fecha ISO válida' }),
    fin: z.string().datetime({ message: 'fin debe ser una fecha ISO válida' }),
    capacidad: z.number().int().positive().optional(),
    lugarId: z.string().uuid().optional(), // opcional, como acordamos — se puede asignar después
  })
  // refine: replica el CHECK (fin > inicio) de la tabla, para dar error
  // claro antes de llegar a la DB.
  .refine((data) => new Date(data.fin) > new Date(data.inicio), {
    message: 'fin debe ser posterior a inicio',
    path: ['fin'],
  });

const crearTallerSchema = z.object({
  params: z.object({
    eventoId: z.string().uuid('Id de evento inválido'),
  }),
  body: tallerSchema,
});

const editarTallerSchema = z.object({
  params: z.object({
    id: z.string().uuid('Id de taller inválido'),
  }),
  body: z.object({
    nombre: z.string().min(1).max(150).optional(),
    inicio: z.string().datetime().optional(),
    fin: z.string().datetime().optional(),
    capacidad: z.number().int().positive().nullable().optional(),
    lugarId: z.string().uuid().nullable().optional(), // nullable: permite desasignar el lugar
  }),
});

const idParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Id de taller inválido'),
  }),
});

const asignarParticipanteSchema = z.object({
  params: z.object({
    id: z.string().uuid('Id de taller inválido'),
  }),
  body: z.object({
    participanteId: z.string().uuid('Id de participante inválido'),
  }),
});

const desasignarParticipanteSchema = z.object({
  params: z.object({
    id: z.string().uuid('Id de taller inválido'),
    participanteId: z.string().uuid('Id de participante inválido'),
  }),
});

module.exports = {
  tallerSchema,
  crearTallerSchema,
  editarTallerSchema,
  idParamSchema,
  asignarParticipanteSchema,
  desasignarParticipanteSchema,
};