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
      modo_taller: datos.modoTaller,
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

module.exports = {
  contarPorOrganizacion,
  buscarActivoPorCodigo,
  crear,
  listarPorOrganizacion,
  buscarPorId,
  actualizar,
  eliminar,
};