const { z } = require('zod');

const completarOrganizacionSchema = z.object({
  params: z.object({
    id: z.string().uuid('Id de organización inválido'),
  }),
  body: z.object({
    nombre: z.string().min(1, 'El nombre es obligatorio').max(150),
  }),
});

const invitarMiembroSchema = z.object({
  params: z.object({
    id: z.string().uuid('Id de organización inválido'),
  }),
  body: z.object({
    email: z.string().email('Email inválido'),
    // Solo obligatorio si la organización sigue implícita — esa validación
    // condicional la hacemos en el service, no acá, porque Zod no sabe
    // en este punto si la organización es implícita o no (eso requiere
    // consultar la base de datos, y los schemas no deben hacer queries).
    nombreOrganizacion: z.string().min(1).max(150).optional(),
  }),
});

const quitarMiembroSchema = z.object({
  params: z.object({
    id: z.string().uuid('Id de organización inválido'),
    usuarioId: z.string().uuid('Id de usuario inválido'),
  }),
});

const actualizarRolSchema = z.object({
  params: z.object({
    id: z.string().uuid('Id de organización inválido'),
    usuarioId: z.string().uuid('Id de usuario inválido'),
  }),
  body: z.object({
    rol: z.enum(['admin', 'invitado']),
  }),
});

module.exports = {
  completarOrganizacionSchema,
  invitarMiembroSchema,
  quitarMiembroSchema,
  actualizarRolSchema,
};