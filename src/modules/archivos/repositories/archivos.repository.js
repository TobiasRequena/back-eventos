const { db } = require('../../../config/db');

/**
 * Inserta un registro de archivo. Las 4 FKs son independientes y nullable
 * según el MODELO_DATOS.md — acá simplemente guardamos las que vengan,
 * sin validar combinaciones (esa coherencia, si hace falta, la valida
 * el service, no esta capa).
 */
async function crear(datos, trx = db) {
  let orgId = datos.orgId; // ← declarar primero

  if (!orgId && datos.participanteId) {
    const participante = await trx('participante')
      .where({ id: datos.participanteId })
      .select('org_id')
      .first();
    orgId = participante?.org_id;
  }

  const [archivo] = await trx('archivo')
    .insert({
      org_id: orgId, // ← usar la variable, no datos.orgId
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
async function buscarPortadaDeEvento(eventoId, trx = db) {
  const resultado = await trx('archivo')
    .where({ evento_id: eventoId })
    .whereNull('participante_id')
    .whereRaw("key LIKE 'portada_evento/%'")
    .first();
  return resultado;
}

async function eliminar(id, trx = db) {
  return trx('archivo').where({ id }).del();
}

async function buscarComprobantePorParticipante(participanteId) {
  return db('archivo')
    .where({ participante_id: participanteId })
    .orderBy('creado_en', 'desc')
    .first();
}

module.exports = { crear, buscarPorId, buscarPortadaDeEvento, eliminar, buscarComprobantePorParticipante };