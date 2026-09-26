const { db } = require('../../../config/db');

const PREFIJO_GALERIA = 'galeria_evento/';

/**
 * Eventos que la organización eligió mostrar, con inscripción abierta y sin terminar.
 */
async function listarEventosPublicos() {
  return db('evento')
    .join('organizacion', 'organizacion.id', 'evento.org_id')
    .where('evento.mostrar_en_landing', true)
    .andWhere('evento.inscripciones_cerradas', false)
    .andWhere('evento.fecha_fin', '>=', new Date())
    .orderBy('evento.fecha_inicio', 'asc')
    .limit(100)
    .select(
      'evento.codigo',
      'evento.nombre',
      'evento.fecha_inicio',
      'organizacion.nombre as org_nombre',
      'organizacion.logo_url as org_logo_url'
    );
}

/**
 * "Gracias por elegirnos": organizaciones reales que aceptaron aparecer.
 * tiene_eventos le dice al front si ya hay alguna con un evento creado.
 */
async function listarOrganizacionesPublicas() {
  return db('organizacion')
    .where({ mostrar_en_landing: true, es_implicita: false })
    .orderBy('creado_en', 'asc')
    .select(
      'nombre',
      'logo_url',
      'instagram',
      db.raw('EXISTS (SELECT 1 FROM evento WHERE evento.org_id = organizacion.id) AS tiene_eventos')
    );
}

/**
 * Fotos de galería de los 10 eventos terminados más recientes que tengan alguna.
 */
async function listarGaleriaPublica() {
  const eventos = await db('evento')
    .join('organizacion', 'organizacion.id', 'evento.org_id')
    .where('evento.fecha_fin', '<', new Date())
    .whereExists(
      db('archivo').whereRaw('archivo.evento_id = evento.id').andWhere('archivo.key', 'like', `${PREFIJO_GALERIA}%`)
    )
    .orderBy('evento.fecha_inicio', 'desc')
    .limit(10)
    .select('evento.id', 'evento.nombre', 'evento.fecha_inicio', 'organizacion.nombre as org_nombre');

  if (eventos.length === 0) return [];

  const fotos = await listarFotosGaleria(eventos.map((e) => e.id));
  return eventos.map((e) => ({ ...e, fotos: fotos.filter((f) => f.evento_id === e.id) }));
}

async function listarFotosGaleria(eventoIds) {
  return db('archivo')
    .whereIn('evento_id', eventoIds)
    .andWhere('key', 'like', `${PREFIJO_GALERIA}%`)
    .orderBy('creado_en', 'asc')
    .select('id', 'evento_id', 'key');
}

async function contarFotosGaleria(eventoId) {
  const [{ count }] = await db('archivo')
    .where({ evento_id: eventoId })
    .andWhere('key', 'like', `${PREFIJO_GALERIA}%`)
    .count('id');
  return Number(count);
}

async function buscarFotoGaleria(eventoId, archivoId) {
  return db('archivo')
    .where({ id: archivoId, evento_id: eventoId })
    .andWhere('key', 'like', `${PREFIJO_GALERIA}%`)
    .first();
}

/**
 * Eventos que terminaron y todavía no avisaron que la galería se habilitó,
 * una fila por cada admin de la organización.
 */
async function listarEventosParaAvisarGaleria() {
  return db('evento')
    .join('usuario_organizacion', 'usuario_organizacion.org_id', 'evento.org_id')
    .join('usuario', 'usuario.id', 'usuario_organizacion.usuario_id')
    .where('evento.fecha_fin', '<', new Date())
    .andWhere('evento.galeria_notificada', false)
    .andWhere('usuario_organizacion.rol', 'admin')
    .andWhere('usuario.activo', true)
    .select('evento.id as evento_id', 'evento.nombre as evento_nombre', 'usuario.nombre', 'usuario.email');
}

async function marcarGaleriaNotificada(eventoId) {
  await db('evento').where({ id: eventoId }).update({ galeria_notificada: true });
}

async function crearSugerencia(texto) {
  await db('sugerencia_funcion').insert({ texto });
}

/**
 * Suma (+1) o resta (-1) un voto al contador total de una función.
 */
async function sumarVoto(funcion, delta, trx = db) {
  await trx.raw(
    `INSERT INTO interes_funcion (funcion, votos) VALUES (?, GREATEST(?, 0))
     ON CONFLICT (funcion) DO UPDATE SET votos = GREATEST(interes_funcion.votos + ?, 0)`,
    [funcion, delta, delta]
  );
}

/**
 * Devuelve true si el usuario no la tenía marcada (o sea, si hay que contar el voto).
 */
async function marcarDeUsuario(usuarioId, funcion, trx = db) {
  const filas = await trx('interes_funcion_usuario')
    .insert({ usuario_id: usuarioId, funcion })
    .onConflict(['usuario_id', 'funcion'])
    .ignore()
    .returning('funcion');
  return filas.length > 0;
}

/**
 * Devuelve true si el usuario la tenía marcada (o sea, si hay que descontar el voto).
 */
async function desmarcarDeUsuario(usuarioId, funcion, trx = db) {
  const borradas = await trx('interes_funcion_usuario').where({ usuario_id: usuarioId, funcion }).del();
  return borradas > 0;
}

async function listarDeUsuario(usuarioId) {
  const filas = await db('interes_funcion_usuario').where({ usuario_id: usuarioId }).select('funcion');
  return filas.map((f) => f.funcion);
}

module.exports = {
  PREFIJO_GALERIA,
  listarEventosPublicos,
  listarOrganizacionesPublicas,
  listarGaleriaPublica,
  listarFotosGaleria,
  contarFotosGaleria,
  buscarFotoGaleria,
  listarEventosParaAvisarGaleria,
  marcarGaleriaNotificada,
  crearSugerencia,
  sumarVoto,
  marcarDeUsuario,
  desmarcarDeUsuario,
  listarDeUsuario,
};
