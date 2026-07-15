const { db } = require('../../../config/db');

/**
 * Cuenta cuántos eventos tiene ya una organización. Se usa en el service
 * para la regla "el primer evento es gratis" (RN07) — contamos ANTES
 * de insertar el nuevo, así que si devuelve 0, este va a ser el primero.
 */
async function contarPorOrganizacion(orgId, trx = db) {
  const [{ count }] = await trx('evento').where({ org_id: orgId }).count('id');
  return Number(count);
}

/**
 * Busca un evento "activo" con un código dado — activo quiere decir que
 * su fecha_fin todavía no pasó. Esta es la query que reemplaza al UNIQUE
 * que sacamos de la columna: la unicidad ahora es "no puede haber dos
 * eventos con el mismo código que estén vigentes al mismo tiempo".
 *
 * Se usa en el service antes de crear un evento, para validar disponibilidad
 * del código.
 */
async function buscarActivoPorCodigo(codigo, trx = db) {
  return trx('evento')
    .where({ codigo })
    .andWhere('fecha_fin', '>=', new Date())
    .first();
}

/**
 * Inserta un evento nuevo.
 */
async function crear(datos, trx = db) {
  const [evento] = await trx('evento')
    .insert({
      org_id: datos.orgId,
      creado_por_usuario_id: datos.creadoPorUsuarioId,
      nombre: datos.nombre,
      descripcion: datos.descripcion ?? null,
      codigo: datos.codigo,
      fecha_inicio: datos.fechaInicio,
      fecha_fin: datos.fechaFin,
      imagen_url: datos.imagenUrl ?? null,
      politica_menor: datos.politicaMenor,
      tiene_grupos: datos.tieneGrupos,
      tiene_talleres: datos.tieneTalleres,
      cbu_cvu: datos.cbuCvu ?? null,
      alias_cobro: datos.aliasCobro ?? null,
      costo: datos.costo,
    })
    .returning('*');

  return evento;
}

/**
 * Lista los eventos de una organización. Ordenados por fecha_inicio
 * descendente (los más próximos/recientes primero) — criterio razonable
 * por defecto para un dashboard.
 */
async function listarPorOrganizacion(orgId) {
  return db('evento').where({ org_id: orgId }).orderBy('fecha_inicio', 'desc');
}

/**
 * Busca un evento por id. No filtra por org_id acá —esa verificación
 * de pertenencia la hace el service, comparando evento.org_id con
 * req.orgId, porque el repository no debe tomar decisiones de autorización.
 */
async function buscarPorId(id, trx = db) {
  return trx('evento').where({ id }).first();
}

/**
 * Busca un evento por su código público, sin filtrar por vigencia
 * (a diferencia de buscarActivoPorCodigo). Se usa en el endpoint público
 * GET /eventos/codigo/:codigo, donde alguien externo (un participante)
 * busca el evento para inscribirse — ahí sí nos interesa solo el vigente,
 * pero esa decisión también la deja el service, reusando buscarActivoPorCodigo.
 */
async function actualizar(id, datos, trx = db) {
  const [evento] = await trx('evento').where({ id }).update(datos).returning('*');
  return evento;
}

async function eliminar(id, trx = db) {
  return trx('evento').where({ id }).del();
}

/**
 * Cuenta el total de inscriptos de un evento.
 */
async function contarInscriptos(eventoId) {
  const [{ count }] = await db('participante').where({ evento_id: eventoId }).count('id');
  return Number(count);
}

/**
 * Cuenta los inscriptos a un taller puntual (via participante_taller).
 */
async function contarInscriptosPorTaller(tallerId) {
  const [{ count }] = await db('participante_taller').where({ taller_id: tallerId }).count('id');
  return Number(count);
}

/**
 * Trae todas las respuestas_form de los participantes de un evento —
 * cada fila es un JSONB { [campo_form_id]: valor }.
 * Se usa para calcular las respuestas populares de los campos del formulario.
 */
async function listarRespuestasForm(eventoId) {
  return db('participante')
    .where({ evento_id: eventoId })
    .whereNotNull('respuestas_form')
    .select('respuestas_form');
}

/**
 * Trae todos los participantes de un evento con grupo, talleres asignados
 * y estado de acreditación — todo en una sola query con JOINs.
 */
async function listarInscriptosCompleto(eventoId) {
  // Participantes con grupo y acreditación
  const participantes = await db('participante')
    .leftJoin('grupo', 'grupo.id', 'participante.grupo_id')
    .leftJoin('checkin', 'checkin.participante_id', 'participante.id')
    .where('participante.evento_id', eventoId)
    .select(
      'participante.*',
      'grupo.nombre as grupo_nombre',
      db.raw('(checkin.id IS NOT NULL) as acreditado')
    )
    .orderBy('participante.apellido', 'asc');

  // Talleres asignados por participante
  const asignaciones = await db('participante_taller')
    .join('taller', 'taller.id', 'participante_taller.taller_id')
    .whereIn(
      'participante_taller.participante_id',
      participantes.map((p) => p.id)
    )
    .select(
      'participante_taller.participante_id',
      'taller.nombre as taller_nombre'
    );

  // Agrupamos los talleres por participante en memoria
  const talleresPorParticipante = {};
  for (const a of asignaciones) {
    if (!talleresPorParticipante[a.participante_id]) {
      talleresPorParticipante[a.participante_id] = [];
    }
    talleresPorParticipante[a.participante_id].push(a.taller_nombre);
  }

  return participantes.map((p) => ({
    ...p,
    talleres: talleresPorParticipante[p.id] ?? [],
  }));
}

module.exports = {
  contarPorOrganizacion,
  buscarActivoPorCodigo,
  crear,
  listarPorOrganizacion,
  buscarPorId,
  actualizar,
  eliminar,
  contarInscriptos,
  contarInscriptosPorTaller,
  listarRespuestasForm,
  listarInscriptosCompleto,
};