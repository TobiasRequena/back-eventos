const { db } = require('../../../config/db');

/**
 * Inserta un registro de archivo. Las 4 FKs son independientes y nullable
 * según el MODELO_DATOS.md — acá simplemente guardamos las que vengan,
 * sin validar combinaciones (esa coherencia, si hace falta, la valida
 * el service, no esta capa).
 */
async function crear(datos, trx = db) {
  const [archivo] = await trx('archivo')
    .insert({
      org_id: datos.orgId,
      evento_id: datos.eventoId ?? null,
      participante_id: datos.participanteId ?? null,
      subido_por_usuario_id: datos.subidoPorUsuarioId ?? null,
      subido_por_participante_id: datos.subidoPorParticipanteId ?? null,
      key: datos.key,
      nombre_original: datos.nombreOriginal,
      mime_type: datos.mimeType,
      size_bytes: datos.sizeBytes,
    })
    .returning('*');

  return archivo;
}

/**
 * Busca un archivo por id.
 */
async function buscarPorId(id, trx = db) {
  return trx('archivo').where({ id }).first();
}

/**
 * Busca el archivo de portada de un evento puntual (el más reciente,
 * por si en algún momento se reemplaza la portada y queda más de uno
 * histórico — nos interesa siempre el último).
 */
async function buscarPortadaDeEvento(eventoId) {
  return db('archivo')
    .where({ evento_id: eventoId })
    .orderBy('creado_en', 'desc')
    .first();
}

async function eliminar(id, trx = db) {
  return trx('archivo').where({ id }).del();
}

module.exports = { crear, buscarPorId, buscarPortadaDeEvento, eliminar };