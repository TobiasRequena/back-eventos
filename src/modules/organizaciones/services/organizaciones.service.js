const { db } = require('../../../config/db');
const organizacionesRepository = require('../repositories/organizaciones.repository');
const authRepository = require('../../auth/repositories/auth.repository');

/**
 * Completa los datos de una organización implícita (le pone nombre real
 * y la marca como NO implícita). También sirve para "renombrar" una
 * organización que ya estaba completa — no hay necesidad de dos funciones
 * distintas para eso, el UPDATE es el mismo.
 */
async function completarOrganizacion(orgId, { nombre }, trx) {
  const organizacion = await organizacionesRepository.buscarPorId(orgId, trx);

  if (!organizacion) {
    const error = new Error('Organización no encontrada');
    error.status = 404;
    throw error;
  }

  return organizacionesRepository.actualizar(orgId, { nombre, esImplicita: false }, trx);
}

/**
 * Lista las organizaciones del usuario autenticado.
 */
async function listarMisOrganizaciones(usuarioId) {
  return organizacionesRepository.listarPorUsuario(usuarioId);
}

/**
 * Lista los miembros de una organización puntual.
 */
async function listarMiembros(orgId) {
  return organizacionesRepository.listarMiembros(orgId);
}

/**
 * Invita un usuario existente a una organización.
 *
 * Regla de negocio (documentada en MODELO_DATOS.md):
 * "No permitir invitaciones (usuario_organizacion) mientras
 * organizacion.es_implicita = TRUE — forzar a completar la organización primero."
 *
 * Como decidimos que esto se resuelve automáticamente (no con un paso separado),
 * si la organización sigue implícita Y vino nombreOrganizacion en el body,
 * la completamos antes de invitar. Si no vino el nombre, error claro pidiendo ese dato.
 */
async function invitarMiembro(orgId, { email, nombreOrganizacion }) {
  return db.transaction(async (trx) => {
    const organizacion = await organizacionesRepository.buscarPorId(orgId, trx);

    if (!organizacion) {
      const error = new Error('Organización no encontrada');
      error.status = 404;
      throw error;
    }

    // Si sigue implícita, hay que completarla en el mismo paso.
    if (organizacion.es_implicita) {
      if (!nombreOrganizacion) {
        const error = new Error(
          'Para invitar miembros primero hay que completar el nombre de la organización'
        );
        error.status = 400;
        throw error;
      }

      // Reusamos la función que ya escribimos, dentro de la misma transacción.
      await completarOrganizacion(orgId, { nombre: nombreOrganizacion }, trx);
    }

    // Buscar el usuario a invitar por email. Tiene que ya tener cuenta creada —
    // este endpoint no crea usuarios nuevos, solo vincula existentes
    // (si el día de mañana se quiere invitar por email a alguien sin cuenta,
    // eso es un flujo distinto, de "invitación pendiente", fuera de este alcance).
    const usuarioAInvitar = await authRepository.buscarUsuarioPorEmail(email);
    if (!usuarioAInvitar) {
      const error = new Error('No existe ningún usuario registrado con ese email');
      error.status = 404;
      throw error;
    }

    // Evitar duplicados — el UNIQUE de la tabla ya lo impediría, pero
    // preferimos un mensaje claro en vez del error crudo de PostgreSQL.
    const vinculoExistente = await organizacionesRepository.buscarVinculo(
      usuarioAInvitar.id,
      orgId
    );
    if (vinculoExistente) {
      const error = new Error('El usuario ya pertenece a esta organización');
      error.status = 409;
      throw error;
    }

    const vinculo = await organizacionesRepository.crearVinculo(
      { usuarioId: usuarioAInvitar.id, orgId, rol: 'invitado' },
      trx
    );

    return {
      usuario: {
        id: usuarioAInvitar.id,
        nombre: usuarioAInvitar.nombre,
        apellido: usuarioAInvitar.apellido,
        email: usuarioAInvitar.email,
      },
      rol: vinculo.rol,
    };
  });
}

/**
 * Quita un miembro de la organización.
 */
async function quitarMiembro(orgId, usuarioId) {
  const vinculo = await organizacionesRepository.buscarVinculo(usuarioId, orgId);
  if (!vinculo) {
    const error = new Error('Ese usuario no pertenece a esta organización');
    error.status = 404;
    throw error;
  }

  await organizacionesRepository.quitarVinculo(usuarioId, orgId);
}

module.exports = {
  completarOrganizacion,
  listarMisOrganizaciones,
  listarMiembros,
  invitarMiembro,
  quitarMiembro,
};