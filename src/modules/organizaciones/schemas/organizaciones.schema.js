const { z } = require('zod');

// Redes: usuarios (nunca links de perfil) y una URL http(s) para la web.
// undefined = no tocar, null / '' = borrar. Las regex espejan los CHECK de la tabla.
const usuarioRed = (regex, mensaje) =>
  z
    .string()
    .trim()
    .transform((s) => s.replace(/^@/, ''))
    .refine((s) => s === '' || regex.test(s), mensaje)
    .transform((s) => s || null)
    .nullish();

const sitioWeb = z
  .string()
  .trim()
  .transform((s, ctx) => {
    if (!s) return null;
    const invalido = (message) => {
      ctx.addIssue({ code: 'custom', message });
      return z.NEVER;
    };
    let url;
    try {
      url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`);
    } catch {
      return invalido('Sitio web inválido');
    }
    const host = url.hostname;
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      !host.includes('.') ||
      /^[\d.]+$/.test(host) || // IPv4 literal
      host.startsWith('[') || // IPv6 literal
      url.href.length > 255
    ) {
      return invalido('Ingresá una dirección web válida (ej. https://mi-sitio.org)');
    }
    return url.href;
  })
  .nullish();

const redesShape = {
  sitioWeb,
  instagram: usuarioRed(
    /^[A-Za-z0-9._]{1,30}$/,
    'Instagram: ingresá solo el nombre de usuario, sin link'
  ),
  twitter: usuarioRed(/^[A-Za-z0-9_]{1,15}$/, 'Twitter: ingresá solo el nombre de usuario, sin link'),
  facebook: usuarioRed(
    /^[A-Za-z0-9.]{5,50}$/,
    'Facebook: ingresá solo el nombre de usuario (5 a 50 caracteres), sin link'
  ),
};

const completarOrganizacionSchema = z.object({
  params: z.object({
    id: z.string().uuid('Id de organización inválido'),
  }),
  body: z.object({
    nombre: z.string().min(1, 'El nombre es obligatorio').max(150),
    ...redesShape,
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
  redesShape,
  completarOrganizacionSchema,
  invitarMiembroSchema,
  quitarMiembroSchema,
  actualizarRolSchema,
};