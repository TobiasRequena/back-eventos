const { z } = require('zod');

const crearGrupoSchema = z.object({
  body: z.object({
    nombre: z.string().min(1, 'El nombre es obligatorio').max(150),
    parroquia: z.string().max(150).optional(),
    localidad: z.string().max(150).optional(),
    maxIntegrantes: z.number().int().positive('El máximo de integrantes debe ser mayor a 0'),
    eventoId: z.string().uuid('eventoId inválido'),
    responsableId: z.string().uuid('responsableId inválido'),
  }),
});

const editarGrupoSchema = z.object({
  params: z.object({
    id: z.string().uuid('Id de grupo inválido'),
  }),
  body: z.object({
    nombre: z.string().min(1).max(150).optional(),
    parroquia: z.string().max(150).optional(),
    localidad: z.string().max(150).optional(),
    maxIntegrantes: z.number().int().positive().optional(),
  }),
});

const idParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Id de grupo inválido'),
  }),
});

const codigoParamSchema = z.object({
  params: z.object({
    codigoInv: z.string().min(1),
  }),
});

module.exports = {
  crearGrupoSchema,
  editarGrupoSchema,
  idParamSchema,
  codigoParamSchema,
};