const { z } = require('zod');

// Schema de un taller individual, embebido dentro de un bloque.
const tallerSchema = z
  .object({
    nombre: z.string().min(1, 'El nombre del taller es obligatorio').max(150),
    descripcion: z.string().max(2000).optional(),
    inicio: z.string().datetime({ message: 'inicio debe ser una fecha ISO válida' }),
    fin: z.string().datetime({ message: 'fin debe ser una fecha ISO válida' }),
    capacidad: z.number().int().positive().optional(),
    lugarId: z.string().uuid().optional(),
  })
  .refine((data) => new Date(data.fin) > new Date(data.inicio), {
    message: 'fin debe ser posterior a inicio',
    path: ['fin'],
  });

// Taller dentro de un bloque — sin inicio/fin propios
const tallerEnBloqueSchema = z.object({
  nombre: z.string().min(1).max(150),
  descripcion: z.string().max(2000).optional(),
  capacidad: z.number().int().positive().optional(),
  lugarId: z.string().uuid().optional(),
});

// Schema de un bloque, con su array de talleres adentro.
// Se usa tanto embebido en POST /eventos (creación conjunta) como en
// el endpoint standalone POST /eventos/:eventoId/bloques-taller.
// Bloque con talleres adentro — los talleres no tienen inicio/fin
const bloqueTallerSchema = z.object({
  nombre: z.string().min(1).max(150),
  cantidadElegible: z.number().int().positive(),
  esObligatorio: z.boolean().default(false),
  orden: z.number().int().nonnegative(),
  inicio: z.string().datetime({ message: 'inicio debe ser una fecha ISO válida' }).optional(),
  fin: z.string().datetime({ message: 'fin debe ser una fecha ISO válida' }).optional(),
  talleres: z.array(tallerEnBloqueSchema).min(1),
});

const crearBloqueTallerSchema = z.object({
  params: z.object({
    eventoId: z.string().uuid('Id de evento inválido'),
  }),
  body: bloqueTallerSchema,
});

const editarBloqueTallerSchema = z.object({
  params: z.object({
    id: z.string().uuid('Id de bloque inválido'),
  }),
  body: z.object({
    nombre: z.string().min(1).max(150).optional(),
    cantidadElegible: z.number().int().positive().optional(),
    esObligatorio: z.boolean().optional(),
    orden: z.number().int().nonnegative().optional(),
  }),
});

// Para crear un taller suelto DENTRO de un bloque ya existente
// (ej. "agregale otro horario a este bloque").
const crearTallerEnBloqueSchema = z.object({
  params: z.object({
    bloqueId: z.string().uuid('Id de bloque inválido'),
  }),
  body: tallerSchema,
});

const idParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Id inválido'),
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

// Taller suelto — con inicio/fin propios obligatorios
const tallerSueltoSchema = z.object({
  nombre: z.string().min(1).max(150),
  descripcion: z.string().max(2000).optional(),
  capacidad: z.number().int().positive().optional(),
  lugarId: z.string().uuid().optional(),
  esObligatorio: z.boolean().default(false),
  inicio: z.string().datetime({ message: 'inicio debe ser una fecha ISO válida' }),
  fin: z.string().datetime({ message: 'fin debe ser una fecha ISO válida' }),
}).refine((data) => new Date(data.fin) > new Date(data.inicio), {
  message: 'fin debe ser posterior a inicio',
  path: ['fin'],
});

// Schema para crear taller suelto
const crearTallerSueltoSchema = z.object({
  params: z.object({
    eventoId: z.string().uuid(),
  }),
  body: tallerSueltoSchema,
});

// Editar taller — todos opcionales
const editarTallerSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    nombre: z.string().min(1).max(150).optional(),
    descripcion: z.string().max(2000).optional(),
    esObligatorio: z.boolean().optional(),
    inicio: z.string().datetime().optional(),
    fin: z.string().datetime().optional(),
    capacidad: z.number().int().positive().nullable().optional(),
    lugarId: z.string().uuid().nullable().optional(),
  }),
});

module.exports = {
  tallerSchema,
  bloqueTallerSchema,
  crearBloqueTallerSchema,
  editarBloqueTallerSchema,
  crearTallerEnBloqueSchema,
  editarTallerSchema,
  idParamSchema,
  asignarParticipanteSchema,
  desasignarParticipanteSchema,
  crearTallerSueltoSchema,
  tallerSueltoSchema
};