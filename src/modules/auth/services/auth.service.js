const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { db } = require('../../../config/db');
const authRepository = require('../repositories/auth.repository');

const SALT_ROUNDS = 10; // costo del hash — 10 es un estándar razonable, ni muy lento ni inseguro

/**
 * Genera el JWT que el cliente va a mandar en cada request futura
 * (header Authorization: Bearer <token>).
 *
 * Guardamos solo el id del usuario en el payload — nada de datos sensibles,
 * porque el JWT NO está encriptado, solo firmado (cualquiera puede leerlo,
 * pero no puede modificarlo sin invalidar la firma).
 */
function generarToken(usuario) {
    return jwt.sign(
        { sub: usuario.id, email: usuario.email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
}

/**
 * Registra un usuario nuevo.
 *
 * Siempre crea: usuario + organización + vínculo usuario_organizacion (rol admin).
 * La diferencia es si la organización es "implícita" (el usuario omitió el paso)
 * o "real" (el usuario completó el nombre de la organización en el form de registro).
 *
 * Todo pasa dentro de una transacción (db.transaction): si falla cualquier paso,
 * Knex hace ROLLBACK automático y no queda nada a medias en la base.
 */
async function registrar({ nombre, apellido, email, contrasena, organizacion }) {
    // 1. Verificar que el email no esté ya en uso.
    //    Esto se podría dejar que falle por el UNIQUE de la DB, pero chequearlo
    //    antes nos permite devolver un mensaje de error claro en vez de un
    //    error crudo de PostgreSQL ("duplicate key value...").
    const existente = await authRepository.buscarUsuarioPorEmail(email);
    if (existente) {
        const error = new Error('Ya existe una cuenta registrada con ese email');
        error.status = 409; // 409 Conflict es el código semánticamente correcto para esto
        throw error;
    }

    // 2. Hashear la contraseña ANTES de que toque la base de datos.
    //    Nunca, bajo ninguna circunstancia, se guarda contrasena en texto plano.
    const contrasenaHash = await bcrypt.hash(contrasena, SALT_ROUNDS);

    // 3. Decidir si la organización es implícita o no, según si vino el bloque
    //    `organizacion` en el body (el usuario completó el form) o no (omitió).
    const esImplicita = !organizacion;
    const nombreOrganizacion = organizacion?.nombre ?? `Organización de ${nombre}`;

    // 4. Transacción: usuario + organización + vínculo, todo o nada.
    const resultado = await db.transaction(async (trx) => {
        const usuario = await authRepository.crearUsuario(
            { nombre, apellido, email, contrasenaHash },
            trx
        );

        const org = await authRepository.crearOrganizacion(
            { nombre: nombreOrganizacion, esImplicita },
            trx
        );

        await authRepository.vincularUsuarioAOrganizacion(
            { usuarioId: usuario.id, orgId: org.id, rol: 'admin' },
            trx
        );

        return { usuario, organizacion: org };
    });

    // 5. Generar el token ya con el usuario recién creado, para que el front
    //    pueda loguear automáticamente después de registrarse (sin pedir
    //    que el usuario haga login de nuevo).
    const token = generarToken(resultado.usuario);

    return {
        token,
        usuario: sanitizarUsuario(resultado.usuario),
        organizacion: resultado.organizacion,
    };
}

/**
 * Login: verifica email + contraseña, devuelve token si son correctos.
 */
async function iniciarSesion({ email, contrasena }) {
    const usuario = await authRepository.buscarUsuarioPorEmail(email);

    // Importante: el mensaje de error es el MISMO si el email no existe
    // o si la contraseña está mal. Esto evita que un atacante pueda usar
    // el login para descubrir qué emails están registrados (enumeration attack).
    const credencialesInvalidas = () => {
        const error = new Error('Email o contraseña incorrectos');
        error.status = 401;
        throw error;
    };

    if (!usuario) credencialesInvalidas();
    if (!usuario.activo) {
        const error = new Error('Esta cuenta está desactivada');
        error.status = 403;
        throw error;
    }

    const coincide = await bcrypt.compare(contrasena, usuario.contrasena_hash);
    if (!coincide) credencialesInvalidas();

    const token = generarToken(usuario);

    return { token, usuario: sanitizarUsuario(usuario) };
}

/**
 * Devuelve los datos del usuario autenticado + sus organizaciones.
 * Se usa en GET /auth/me, a partir del id que viene en el JWT decodificado.
 */
async function obtenerPerfil(usuarioId) {
    const usuario = await authRepository.buscarUsuarioPorId(usuarioId);
    if (!usuario) {
        const error = new Error('Usuario no encontrado');
        error.status = 404;
        throw error;
    }

    const organizaciones = await authRepository.listarOrganizacionesDeUsuario(usuarioId);

    return { usuario: sanitizarUsuario(usuario), organizaciones };
}

/**
 * Quita el contrasena_hash antes de devolver el usuario al cliente.
 * Esto NUNCA debe llegar al front, ni siquiera dentro de una respuesta
 * que el usuario nunca vaya a leer (loguear esto sería igual de grave).
 */
function sanitizarUsuario(usuario) {
    const { contrasena_hash, ...resto } = usuario;
    return resto;
}

module.exports = { registrar, iniciarSesion, obtenerPerfil };