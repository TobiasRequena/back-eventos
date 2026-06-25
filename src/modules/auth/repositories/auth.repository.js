const { db } = require('../../../config/db');

/**
 * Busca un usuario por email. Se usa tanto en login (verificar credenciales)
 * como en register (verificar que el email no esté ya tomado).
 *
 * Devuelve `undefined` si no existe — Knex hace eso por defecto con .first().
 */
async function buscarUsuarioPorEmail(email) {
    return db('usuario').where({ email }).first();
}

/**
 * Busca un usuario por su id. Se usa por ejemplo en el endpoint /auth/me,
 * para traer los datos actuales del usuario autenticado a partir del JWT.
 */
async function buscarUsuarioPorId(id) {
    return db('usuario').where({ id }).first();
}

/**
 * Inserta un nuevo usuario. Recibe ya el hash de la contraseña (el hasheo
 * NO pasa aquí, pasa en el service — el repository no debe saber de bcrypt,
 * solo de cómo guardar filas).
 *
 * El parámetro `trx` es la transacción de Knex (la vemos en el service).
 * Si no se pasa, Knex usa la conexión normal del pool.
 */
async function crearUsuario({ nombre, apellido, email, contrasenaHash }, trx = db) {
    const [usuario] = await trx('usuario')
        .insert({
            nombre,
            apellido,
            email,
            contrasena_hash: contrasenaHash,
            es_super_admin: false, // por defecto, nadie nace super_admin
            activo: true,
        })
        .returning('*'); // PostgreSQL soporta RETURNING, así evitamos un segundo SELECT

    return usuario;
}

/**
 * Inserta una organización nueva. Se usa tanto para la organización implícita
 * (es_implicita = true) como para la que el usuario completa a mano en el registro.
 */
async function crearOrganizacion({ nombre, esImplicita }, trx = db) {
    const [organizacion] = await trx('organizacion')
        .insert({
            nombre,
            es_implicita: esImplicita,
            configuracion: {}, // JSONB vacío por ahora, libre para el futuro
            estado_facturacion: 'sin_pagos', // estado inicial, no hay eventos creados todavía
        })
        .returning('*');

    return organizacion;
}

/**
 * Vincula un usuario a una organización con un rol (hoy solo existe 'admin'
 * en el enum rol_usuario_org, pero queda preparado para crecer).
 *
 * Esta es la fila que le da al usuario acceso a TODOS los eventos de esa organización.
 */
async function vincularUsuarioAOrganizacion({ usuarioId, orgId, rol = 'admin' }, trx = db) {
    const [vinculo] = await trx('usuario_organizacion')
        .insert({
            usuario_id: usuarioId,
            org_id: orgId,
            rol,
        })
        .returning('*');

    return vinculo;
}

/**
 * Trae todas las organizaciones a las que pertenece un usuario (vía usuario_organizacion),
 * junto con el rol que tiene en cada una. Se usa en GET /auth/me.
 */
async function listarOrganizacionesDeUsuario(usuarioId) {
    return db('usuario_organizacion')
        .join('organizacion', 'organizacion.id', 'usuario_organizacion.org_id')
        .where('usuario_organizacion.usuario_id', usuarioId)
        .select(
            'organizacion.id',
            'organizacion.nombre',
            'organizacion.es_implicita',
            'usuario_organizacion.rol'
        );
}

module.exports = {
    buscarUsuarioPorEmail,
    buscarUsuarioPorId,
    crearUsuario,
    crearOrganizacion,
    vincularUsuarioAOrganizacion,
    listarOrganizacionesDeUsuario,
};