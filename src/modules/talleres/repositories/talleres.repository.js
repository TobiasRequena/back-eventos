const { db } = require('../../../config/db');

// ---------- bloque_taller ----------

/**
 * Inserta varios bloques de una sola vez, junto con sus talleres internos.
 * Se usa desde eventos.service al crear un evento con bloquesTaller incluidos.
 *
 * Cada bloque se inserta primero (para obtener su id), y recién después
 * se insertan sus talleres con ese bloque_taller_id — por eso no podemos
 * hacer un solo bulk insert para todo, hace falta loopear bloque por bloque.
 */
async function crearBloquesConTalleres(eventoId, orgId, bloques, trx = db) {
  if (!bloques || bloques.length === 0) return [];

  const resultado = [];

  for (const bloque of bloques) {
    const [bloqueCreado] = await trx('bloque_taller')
      .insert({
        org_id: orgId,
        evento_id: eventoId,
        nombre: bloque.nombre,
        cantidad_elegible: bloque.cantidadElegible,
        es_obligatorio: bloque.esObligatorio,
        orden: bloque.orden,
      })
      .returning('*');

    const filasTalleres = bloque.talleres.map((t) => ({
      org_id: orgId,
      evento_id: eventoId,
      bloque_taller_id: bloqueCreado.id,
      lugar_id: t.lugarId ?? null,
      nombre: t.nombre,
      descripcion: t.descripcion ?? null,
      inicio: t.inicio,
      fin: t.fin,
      capacidad: t.capacidad ?? null,
    }));

    const talleresCreados = await trx('taller').insert(filasTalleres).returning('*');

    resultado.push({ ...bloqueCreado, talleres: talleresCreados });
  }

  return resultado;
}

/**
 * Lista los bloques de un evento, cada uno con sus talleres anidados.
 * Hace 1 query para bloques + 1 query para todos los talleres del evento
 * (no N+1 por bloque), y los agrupa en memoria.
 */
async function listarBloquesPorEvento(eventoId) {
  const bloques = await db('bloque_taller').where({ evento_id: eventoId }).orderBy('orden', 'asc');
  const talleres = await db('taller').where({ evento_id: eventoId }).orderBy('inicio', 'asc');

  return bloques.map((bloque) => ({
    ...bloque,
    talleres: talleres.filter((t) => t.bloque_taller_id === bloque.id),
  }));
}

async function buscarBloquePorId(id, trx = db) {
  return trx('bloque_taller').where({ id }).first();
}

async function actualizarBloque(id, datos, trx = db) {
  const [bloque] = await trx('bloque_taller').where({ id }).update(datos).returning('*');
  return bloque;
}

async function eliminarBloque(id, trx = db) {
  return trx('bloque_taller').where({ id }).del(); // ON DELETE de taller.bloque_taller_id no tiene CASCADE definido — ver nota abajo
}

// ---------- taller ----------

/**
 * Inserta un taller suelto dentro de un bloque ya existente.
 */
async function crearEnBloque(bloque, datos, trx = db) {
  const [taller] = await trx('taller')
    .insert({
      org_id: bloque.org_id,
      evento_id: bloque.evento_id,
      bloque_taller_id: bloque.id,
      lugar_id: datos.lugarId ?? null,
      nombre: datos.nombre,
      descripcion: datos.descripcion ?? null,
      inicio: datos.inicio,
      fin: datos.fin,
      capacidad: datos.capacidad ?? null,
    })
    .returning('*');

  return taller;
}

async function buscarPorId(id, trx = db) {
  return trx('taller').where({ id }).first();
}

async function actualizar(id, datos, trx = db) {
  const [taller] = await trx('taller').where({ id }).update(datos).returning('*');
  return taller;
}

async function eliminar(id, trx = db) {
  return trx('taller').where({ id }).del();
}

async function contarInscriptos(tallerId, trx = db) {
  const [{ count }] = await trx('participante_taller').where({ taller_id: tallerId }).count('id');
  return Number(count);
}

/**
 * Lista todos los participantes inscriptos a un taller, con todos los
 * campos de participante disponibles. El front decide qué mostrar.
 */
async function listarInscriptos(tallerId) {
  return db('participante_taller')
    .join('participante', 'participante.id', 'participante_taller.participante_id')
    .where('participante_taller.taller_id', tallerId)
    .select(
      // Todos los campos de participante
      'participante.id',
      'participante.org_id',
      'participante.evento_id',
      'participante.grupo_id',
      'participante.nombre',
      'participante.apellido',
      'participante.email',
      'participante.dni',
      'participante.nacimiento',
      'participante.es_mayor',
      'participante.rol_grupo',
      'participante.estado_vinculo',
      'participante.responsable_id',
      'participante.respuestas_form',
      'participante.estado_pago',
      'participante.pagado_por',
      'participante.qr_personal',
      'participante.creado_en',
      'participante.actualizado_en',
      // Dato extra de la tabla puente — útil para saber cuándo se asignó al taller
      'participante_taller.id as inscripcion_taller_id'
    );
}

async function buscarInscripcion(participanteId, tallerId, trx = db) {
  return trx('participante_taller')
    .where({ participante_id: participanteId, taller_id: tallerId })
    .first();
}

/**
 * Cuenta cuántos talleres tiene asignados un participante DENTRO de un
 * bloque puntual — necesario para la regla de negocio de cantidad_elegible
 * (documentada en MODELO_DATOS.md, sección "Reglas que NO están en la base").
 */
async function contarInscripcionesDelParticipanteEnBloque(participanteId, bloqueTallerId, trx = db) {
  const [{ count }] = await trx('participante_taller')
    .join('taller', 'taller.id', 'participante_taller.taller_id')
    .where('participante_taller.participante_id', participanteId)
    .andWhere('taller.bloque_taller_id', bloqueTallerId)
    .count('participante_taller.id');

  return Number(count);
}

async function asignarParticipante({ participanteId, tallerId, orgId }, trx = db) {
  const [inscripcion] = await trx('participante_taller')
    .insert({ participante_id: participanteId, taller_id: tallerId, org_id: orgId })
    .returning('*');

  return inscripcion;
}

async function desasignarParticipante(participanteId, tallerId, trx = db) {
  return trx('participante_taller')
    .where({ participante_id: participanteId, taller_id: tallerId })
    .del();
}

module.exports = {
  crearBloquesConTalleres,
  listarBloquesPorEvento,
  buscarBloquePorId,
  actualizarBloque,
  eliminarBloque,
  crearEnBloque,
  buscarPorId,
  actualizar,
  eliminar,
  contarInscriptos,
  listarInscriptos,
  buscarInscripcion,
  contarInscripcionesDelParticipanteEnBloque,
  asignarParticipante,
  desasignarParticipante,
};