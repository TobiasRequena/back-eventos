const { db } = require('../../../config/db');
const { hashDni } = require('../../../utils/encryption');

/**
 * Verifica si ya existe un participante con el mismo DNI en el mismo evento.
 * Reproduce el UNIQUE (evento_id, dni) de la tabla — lo chequeamos antes
 * del INSERT para dar un mensaje claro en lugar del error crudo de PostgreSQL.
 */
async function buscarPorDniEnEvento(dni, eventoId, trx = db) {
  return trx('participante')
    .where({ dni_hash: hashDni(dni), evento_id: eventoId })
    .first();
}

async function buscarPorId(id, trx = db) {
  return trx('participante').where({ id }).first();
}

async function buscarPorEmailEnEvento(email, eventoId, trx = db) {
  return trx('participante').where({ email, evento_id: eventoId }).first();
}

/**
 * Lista los participantes de un evento, con filtros opcionales.
 * Los filtros (grupoId, estadoPago, rolGrupo) vienen del query string
 * y se aplican dinámicamente solo si están presentes.
 */
async function listarPorEvento(eventoId, filtros = {}) {
  const query = db('participante')
    .leftJoin('grupo', 'grupo.id', 'participante.grupo_id')
    .leftJoin('checkin', 'checkin.participante_id', 'participante.id')
    .where('participante.evento_id', eventoId)
    .select(
      'participante.*',
      // Objeto grupo si existe, null si no
      db.raw(`
        CASE WHEN participante.grupo_id IS NOT NULL
        THEN json_build_object('id', grupo.id, 'nombre', grupo.nombre)
        ELSE NULL END as grupo
      `),
      // Booleano derivado: tiene checkin = está acreditado
      db.raw('(checkin.id IS NOT NULL) as acreditado')
    );

  if (filtros.grupoId) query.andWhere('participante.grupo_id', filtros.grupoId);
  if (filtros.rolGrupo) query.andWhere('participante.rol_grupo', filtros.rolGrupo);
  if (filtros.estadoPago) query.andWhere('participante.estado_pago', filtros.estadoPago);
  if (filtros.estadoVinculo) query.andWhere('participante.estado_vinculo', filtros.estadoVinculo);

  return query.orderBy('participante.creado_en', 'asc');
}

/**
 * Cuenta los participantes de un evento — reemplaza el cantidadInscriptos: 0
 * hardcodeado en eventos.service.
 */
async function contarPorEvento(eventoId, trx = db) {
  const [{ count }] = await trx('participante').where({ evento_id: eventoId }).count('id');
  return Number(count);
}

async function crear(datos, trx = db) {
  try {
    const [participante] = await trx('participante')
      .insert({
        org_id: datos.orgId,
        evento_id: datos.eventoId,
        grupo_id: datos.grupoId ?? null,
        nombre: datos.nombre,
        apellido: datos.apellido,
        email: datos.email,
        dni: datos.dniEncriptado,       // ← encriptado
        dni_hash: datos.dniHash,        // ← hash para búsquedas
        nacimiento: datos.nacimiento,
        es_mayor: datos.esMayor,
        rol_grupo: datos.rolGrupo,
        estado_vinculo: datos.estadoVinculo ?? null,
        responsable_id: datos.responsableId ?? null,
        respuestas_form: JSON.stringify(datos.respuestasForm ?? {}),
        estado_pago: datos.estadoPago ?? 'no_aplica',
        pagado_por: datos.pagadoPor ?? null,
        qr_personal: datos.qrPersonal,
      })
      .returning('*');

    return participante;
  } catch (err) {
    if (err.code === '23505') {
      if (err.constraint === 'uq_participante_dni_evento') {
        const error = new Error('Ya existe un participante con ese DNI en este evento');
        error.status = 409;
        throw error;
      }
      const error = new Error('Ya existe un registro con esos datos');
      error.status = 409;
      throw error;
    }
    throw err;
  }
}

async function actualizar(id, datos, trx = db) {
  const [participante] = await trx('participante').where({ id }).update(datos).returning('*');
  return participante;
}

async function eliminar(id, trx = db) {
  return trx('participante').where({ id }).del();
}

/**
 * Busca un participante por su qr_personal — es la query del escaneo
 * de acreditación. Ya tiene índice implícito por el UNIQUE, así que
 * es rápida incluso con 15.000+ inscriptos.
 */
async function buscarPorQr(qrPersonal, trx = db) {
  return trx('participante').where({ qr_personal: qrPersonal }).first();
}

module.exports = {
  buscarPorDniEnEvento,
  buscarPorId,
  listarPorEvento,
  contarPorEvento,
  crear,
  actualizar,
  eliminar,
  buscarPorQr,
  buscarPorEmailEnEvento
};