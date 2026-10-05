const { db } = require('../../../config/db');

/**
 * Inserta varios campos de formulario de una sola vez (bulk insert),
 * asociados a un evento. Se usa desde eventos.service al crear un evento
 * con camposForm incluidos.
 */
async function crearVarios(eventoId, orgId, campos, trx = db) {
  if (!campos || campos.length === 0) return [];

  const filas = campos.map((campo) => ({
    evento_id: eventoId,
    org_id: orgId,
    etiqueta: campo.etiqueta,
    tipo: campo.tipo,
    opciones: campo.tipo === 'seleccion' ? JSON.stringify(campo.opciones) : null,
    requerido: campo.requerido ?? false,
    multiple: campo.tipo === 'seleccion' && (campo.multiple ?? false),
    orden: campo.orden,
  }));

  return trx('campo_form').insert(filas).returning('*');
}

/**
 * Lista los campos de formulario de un evento, ordenados según el campo `orden`.
 * Por defecto solo los activos: los dados de baja no se piden ni se muestran.
 */
async function listarPorEvento(eventoId, { incluirInactivos = false } = {}) {
  const query = db('campo_form').where({ evento_id: eventoId });
  if (!incluirInactivos) query.andWhere({ activo: true });
  return query.orderBy('orden', 'asc');
}

async function buscarPorId(id, trx = db) {
  return trx('campo_form').where({ id }).first();
}

async function actualizar(id, datos, trx = db) {
  const [campo] = await trx('campo_form').where({ id }).update(datos).returning('*');
  return campo;
}

/**
 * Reordena varios campos en una sola operación.
 * Recibe un array de { id, orden } y actualiza cada uno.
 * Usamos Promise.all para ejecutar todos los UPDATEs en paralelo.
 */
async function reordenar(campos, trx = db) {
  return Promise.all(
    campos.map(({ id, orden }) =>
      trx('campo_form').where({ id }).update({ orden }).returning('*')
    )
  );
}

/**
 * Participantes del evento que respondieron un campo (para migrar respuestas
 * cuando se renombra una opción).
 */
async function listarRespuestasDeCampo(eventoId, campoId, trx = db) {
  return trx('participante')
    .where({ evento_id: eventoId })
    .whereRaw('respuestas_form \\? ?', [campoId])
    .select('id', 'respuestas_form');
}

async function actualizarRespuestas(participanteId, respuestas, trx = db) {
  return trx('participante')
    .where({ id: participanteId })
    .update({ respuestas_form: JSON.stringify(respuestas) });
}

module.exports = {
  crearVarios,
  listarPorEvento,
  buscarPorId,
  actualizar,
  reordenar,
  listarRespuestasDeCampo,
  actualizarRespuestas,
};
