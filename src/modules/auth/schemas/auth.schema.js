const { z } = require('zod');

const registerSchema = z.object({
    body: z.object({
        nombre: z.string().min(1, 'El nombre es obligatorio').max(100),
        apellido: z.string().min(1, 'El apellido es obligatorio').max(100),
        email: z.string().email('Email inválido').max(255),
        contrasena: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
        organizacion: z
            .object({
                nombre: z.string().min(1, 'El nombre de la organización es obligatorio').max(150),
            })
            .optional(),
    }),
});

const loginSchema = z.object({
    body: z.object({
        email: z.string().email('Email inválido'),
        contrasena: z.string().min(1, 'La contraseña es obligatoria'),
    }),
});

const recuperarContrasenaSchema = z.object({
    body: z.object({
        email: z.string().email('Email inválido'),
    }),
});

const resetContrasenaSchema = z.object({
    body: z.object({
        email: z.string().email('Email inválido'),
        codigo: z.string().length(6, 'El código debe tener 6 dígitos'),
        nuevaContrasena: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
    }),
});

module.exports = { registerSchema, loginSchema, recuperarContrasenaSchema, resetContrasenaSchema };