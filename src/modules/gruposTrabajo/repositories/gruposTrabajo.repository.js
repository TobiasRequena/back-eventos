const { db } = require('../../../config/db');

// ─── ESQUEMAS ───────────────────────────────────────────────────────────────

async function crearEsquema(datos, trx = db) {
  const [esquema] = await trx('esquema_grupos_trabajo')
    .insert({
      org_id: datos.orgId,
      evento_id: datos.eventoId,
      nombre: datos.nombre,
      universo_base: datos.universoBase,
      criterio_tanda_atributo: null,
      modo_tamano: datos.modoTamano,
      valor_tamano: datos.valorTamano,
      balanceo_atributo: null,
      filtro_elegibilidad: null,
      modo_nombrado: 'por_grupo',
      accion_sin_nombres: datos.accionSinNombres,
      nombres_preset: datos.nombresPreset,
      nombres_lista: JSON.stringify(datos.nombresLista ?? []),
      mantener_grupos_inscripcion: datos.mantenerGruposInscripcion ?? false,
      estado: 'borrador',
      creado_por_usuario_id: datos.creadoPorUsuarioId,
    })
    .returning('*');
  return esquema;
}

async function listarPorEvento(eventoId) {
  return db('esquema_grupos_trabajo')
    .where({ evento_id: eventoId })
    .orderBy('creado_en', 'desc');
}

async function buscarPorId(id, trx = db) {
  return trx('esquema_grupos_trabajo').where({ id }).first();
}

async function actualizarEsquema(id, datos, trx = db) {
  const [esquema] = await trx('esquema_grupos_trabajo')
    .where({ id })
    .update(datos)
    .returning('*');
  return esquema;
}

async function eliminarEsquema(id, trx = db) {
  return trx('esquema_grupos_trabajo').where({ id }).del();
}

// ─── TANDAS ─────────────────────────────────────────────────────────────────

async function crearTanda(datos, trx = db) {
  const [tanda] = await trx('tanda')
    .insert({
      org_id: datos.orgId,
      evento_id: datos.eventoId,
      esquema_id: datos.esquemaId,
      orden: datos.orden,
      nombre_resuelto: datos.nombreResuelto ?? null,
      condicion: JSON.stringify(datos.condicion),
    })
    .returning('*');
  return tanda;
}

async function listarTandasPorEsquema(esquemaId, trx = db) {
  return trx('tanda')
    .where({ esquema_id: esquemaId })
    .orderBy('orden', 'asc');
}

async function buscarTandaPorId(id, trx = db) {
  return trx('tanda').where({ id }).first();
}

async function actualizarTanda(id, datos, trx = db) {
  const [tanda] = await trx('tanda').where({ id }).update(datos).returning('*');
  return tanda;
}

async function eliminarTanda(id, trx = db) {
  return trx('tanda').where({ id }).del();
}

async function reordenarTandas(tandas, trx = db) {
  return Promise.all(
    tandas.map(({ id, orden }) => trx('tanda').where({ id }).update({ orden }))
  );
}

// ─── GRUPOS DE TRABAJO ───────────────────────────────────────────────────────

async function crearGruposTrabajo(grupos, trx = db) {
  if (!grupos.length) return [];
  return trx('grupo_trabajo').insert(grupos).returning('*');
}

async function listarGruposPorEsquema(esquemaId) {
  const grupos = await db('grupo_trabajo')
    .where({ esquema_id: esquemaId })
    .orderBy('orden_global', 'asc');

  const integrantes = await db('grupo_trabajo_participante')
    .join('participante', 'participante.id', 'grupo_trabajo_participante.participante_id')
    .whereIn('grupo_trabajo_participante.grupo_trabajo_id', grupos.map(g => g.id))
    .select(
      'grupo_trabajo_participante.grupo_trabajo_id',
      'participante.id',
      'participante.nombre',
      'participante.apellido',
      'participante.dni',
    );

  return grupos.map(g => ({
    ...g,
    integrantes: integrantes.filter(i => i.grupo_trabajo_id === g.id),
  }));
}

async function eliminarGruposDeEsquema(esquemaId, trx = db) {
  return trx('grupo_trabajo').where({ esquema_id: esquemaId }).del();
}

async function buscarGrupoPorId(id, trx = db) {
  return trx('grupo_trabajo').where({ id }).first();
}

// ─── INTEGRANTES ─────────────────────────────────────────────────────────────

async function agregarIntegrantes(filas, trx = db) {
  if (!filas.length) return [];
  return trx('grupo_trabajo_participante').insert(filas).returning('*');
}

async function buscarIntegrante(grupoTrabajoId, participanteId, trx = db) {
  return trx('grupo_trabajo_participante')
    .where({ grupo_trabajo_id: grupoTrabajoId, participante_id: participanteId })
    .first();
}

async function moverIntegrante(participanteId, grupoOrigenId, grupoDestinoId, trx = db) {
  await trx('grupo_trabajo_participante')
    .where({ participante_id: participanteId, grupo_trabajo_id: grupoOrigenId })
    .del();
  const [fila] = await trx('grupo_trabajo_participante')
    .insert({ grupo_trabajo_id: grupoDestinoId, participante_id: participanteId })
    .returning('*');
  return fila;
}

async function eliminarIntegrante(grupoTrabajoId, participanteId, trx = db) {
  return trx('grupo_trabajo_participante')
    .where({ grupo_trabajo_id: grupoTrabajoId, participante_id: participanteId })
    .del();
}

// ─── PENDIENTES ──────────────────────────────────────────────────────────────

async function agregarPendientes(filas, trx = db) {
  if (!filas.length) return [];
  return trx('participante_esquema_pendiente')
    .insert(filas)
    .onConflict(['esquema_id', 'participante_id'])
    .merge(['motivo'])
    .returning('*');
}

async function listarPendientesPorEsquema(esquemaId) {
  return db('participante_esquema_pendiente')
    .join('participante', 'participante.id', 'participante_esquema_pendiente.participante_id')
    .where('participante_esquema_pendiente.esquema_id', esquemaId)
    .select(
      'participante_esquema_pendiente.motivo',
      'participante.id as id',
      'participante.nombre',
      'participante.apellido',
      'participante.dni',
    );
}

async function buscarPendiente(esquemaId, participanteId, trx = db) {
  return trx('participante_esquema_pendiente')
    .where({ esquema_id: esquemaId, participante_id: participanteId })
    .first();
}

async function eliminarPendiente(esquemaId, participanteId, trx = db) {
  return trx('participante_esquema_pendiente')
    .where({ esquema_id: esquemaId, participante_id: participanteId })
    .del();
}

async function eliminarPendientesDeEsquema(esquemaId, trx = db) {
  return trx('participante_esquema_pendiente').where({ esquema_id: esquemaId }).del();
}

async function listarExcluidosAdmin(esquemaId, trx = db) {
  return trx('participante_esquema_pendiente')
    .where({ esquema_id: esquemaId, motivo: 'excluido_admin' })
    .select('participante_id');
}

module.exports = {
  crearEsquema,
  listarPorEvento,
  buscarPorId,
  actualizarEsquema,
  eliminarEsquema,
  crearTanda,
  listarTandasPorEsquema,
  buscarTandaPorId,
  actualizarTanda,
  eliminarTanda,
  reordenarTandas,
  crearGruposTrabajo,
  listarGruposPorEsquema,
  eliminarGruposDeEsquema,
  buscarGrupoPorId,
  agregarIntegrantes,
  buscarIntegrante,
  moverIntegrante,
  eliminarIntegrante,
  agregarPendientes,
  listarPendientesPorEsquema,
  buscarPendiente,
  eliminarPendiente,
  eliminarPendientesDeEsquema,
  listarExcluidosAdmin,
};