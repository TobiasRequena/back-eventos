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
      cupo_maximo: datos.cupoMaximo ?? null,
      tiene_grupos: datos.tieneGrupos,
      tiene_talleres: datos.tieneTalleres,
      cbu_cvu: datos.cbuCvu ?? null,
      alias_cobro: datos.aliasCobro ?? null,
      costo: datos.costo,
      config_ficha_medica: datos.configFichaMedica ?? 'no',
      config_certificado: datos.configCertificado ?? 'no',
      requiere_autorizacion_menores: datos.requiereAutorizacionMenores ?? false,
      autorizacion_template_url: datos.autorizacionTemplateUrl ?? null,
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
  const [{ count }] = await db('participante').where({ evento_id: eventoId, activo: true }).count('id');
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
    .where({ evento_id: eventoId, activo: true })
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
    .leftJoin('ficha_medica', 'ficha_medica.participante_id', 'participante.id')
    .where('participante.evento_id', eventoId)
    .where('participante.activo', true)
    .select(
      'participante.*',
      'grupo.nombre as grupo_nombre',
      db.raw('(checkin.id IS NOT NULL) as acreditado'),
      db.raw('(ficha_medica.id IS NOT NULL) as tiene_ficha_medica'),
      db.raw('(participante.autorizacion_url IS NOT NULL) as tiene_autorizacion'),
      db.raw('(participante.certificado_url IS NOT NULL) as tiene_certificado'),
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

/**
 * Cuenta inscripciones por día para una organización en un rango de fechas.
 * Usa DATE_TRUNC para agrupar por día (PostgreSQL).
 * Solo devuelve los días que tienen inscripciones — los días con 0
 * los completamos en el service.
 */
async function contarInscripcionesPorDia(orgId, fechaInicio, fechaFin) {
  return db('participante')
    .where({ org_id: orgId })
    .andWhere('creado_en', '>=', fechaInicio)
    .andWhere('creado_en', '<=', fechaFin)
    .select(db.raw(`DATE_TRUNC('day', creado_en AT TIME ZONE 'America/Argentina/Buenos_Aires') as fecha`))
    .count('id as inscripciones')
    .groupByRaw(`DATE_TRUNC('day', creado_en AT TIME ZONE 'America/Argentina/Buenos_Aires')`)
    .orderBy('fecha', 'asc');
}

async function resumenPagos(eventoId) {
  const filas = await db('participante')
    .where({ evento_id: eventoId, activo: true })
    .groupBy('estado_pago')
    .select('estado_pago')
    .count('id as cantidad');

  const resumen = {
    no_aplica: 0,
    pendiente: 0,
    pendiente_aprobacion: 0,
    aprobado: 0,
    rechazado: 0,
  };

  for (const fila of filas) {
    if (resumen[fila.estado_pago] !== undefined) {
      resumen[fila.estado_pago] = Number(fila.cantidad);
    }
  }

  return resumen;
}

async function kpisFichaMedica(eventoId) {
  const filas = await db('ficha_medica')
    .join('participante', 'participante.id', 'ficha_medica.participante_id')
    .where('ficha_medica.evento_id', eventoId)
    .where('participante.activo', true)
    .select(
      db.raw('COUNT(*) as total'),
      db.raw('COUNT(*) FILTER (WHERE ficha_medica.tiene_diabetes = true) as con_diabetes'),
      db.raw('COUNT(*) FILTER (WHERE ficha_medica.tiene_asma = true) as con_asma'),
      db.raw('COUNT(*) FILTER (WHERE ficha_medica.tiene_epilepsia = true) as con_epilepsia'),
      db.raw('COUNT(*) FILTER (WHERE ficha_medica.tiene_cardiopatia = true) as con_cardiopatia'),
      db.raw('COUNT(*) FILTER (WHERE ficha_medica.otras_condiciones IS NOT NULL) as con_otras_condiciones'),
      db.raw('COUNT(*) FILTER (WHERE ficha_medica.alergias IS NOT NULL) as con_alergias'),
      db.raw('COUNT(*) FILTER (WHERE ficha_medica.restricciones_alimentarias IS NOT NULL) as con_restricciones_alimentarias'),
      db.raw('COUNT(*) FILTER (WHERE ficha_medica.tiene_discapacidad = true) as con_discapacidad'),
      db.raw('COUNT(*) FILTER (WHERE ficha_medica.recomendaciones IS NOT NULL) as con_recomendaciones'),
      db.raw(`COUNT(*) FILTER (WHERE ficha_medica.medicacion IS NOT NULL AND participante.es_mayor = false) as con_medicacion_menores`),
    )
    .first();

  return {
    total: Number(filas.total),
    conDiabetes: Number(filas.con_diabetes),
    conAsma: Number(filas.con_asma),
    conEpilepsia: Number(filas.con_epilepsia),
    conCardiopatia: Number(filas.con_cardiopatia),
    conOtrasCondiciones: Number(filas.con_otras_condiciones),
    conAlergias: Number(filas.con_alergias),
    conRestriccionesAlimentarias: Number(filas.con_restricciones_alimentarias),
    conDiscapacidad: Number(filas.con_discapacidad),
    conRecomendaciones: Number(filas.con_recomendaciones),
    conMedicacionMenores: Number(filas.con_medicacion_menores),
  };
}

async function listarFichasMedicasRelevantes(eventoId) {
  return db('ficha_medica')
    .join('participante', 'participante.id', 'ficha_medica.participante_id')
    .where('ficha_medica.evento_id', eventoId)
    .where('participante.activo', true)
    .where(function () {
      this.where('ficha_medica.tiene_diabetes', true)
        .orWhere('ficha_medica.tiene_asma', true)
        .orWhere('ficha_medica.tiene_epilepsia', true)
        .orWhere('ficha_medica.tiene_cardiopatia', true)
        .orWhereNotNull('ficha_medica.otras_condiciones')
        .orWhereNotNull('ficha_medica.alergias')
        .orWhereNotNull('ficha_medica.restricciones_alimentarias')
        .orWhere('ficha_medica.tiene_discapacidad', true)
        .orWhereNotNull('ficha_medica.recomendaciones')
        .orWhere(function () {
          this.whereNotNull('ficha_medica.medicacion')
            .andWhere('participante.es_mayor', false);
        });
    })
    .select(
      'participante.id as participante_id',
      'participante.nombre',
      'participante.apellido',
      'participante.nacimiento',
      'participante.es_mayor',
      'ficha_medica.tiene_diabetes',
      'ficha_medica.tiene_asma',
      'ficha_medica.tiene_epilepsia',
      'ficha_medica.tiene_cardiopatia',
      'ficha_medica.otras_condiciones',
      'ficha_medica.alergias',
      'ficha_medica.restricciones_alimentarias',
      'ficha_medica.tiene_discapacidad',
      'ficha_medica.adaptaciones',
      'ficha_medica.recomendaciones',
      db.raw(`CASE WHEN participante.es_mayor = false THEN ficha_medica.medicacion ELSE NULL END as medicacion`),
    )
    .orderBy('participante.apellido', 'asc');
}

async function contarAcreditados(eventoId) {
  const [{ count }] = await db('checkin')
    .join('participante', 'participante.id', 'checkin.participante_id')
    .where('participante.evento_id', eventoId)
    .where('participante.activo', true)
    .count('checkin.id as count');
  return Number(count);
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
  contarInscripcionesPorDia,
  resumenPagos,
  kpisFichaMedica,
  listarFichasMedicasRelevantes,
  contarAcreditados,
};