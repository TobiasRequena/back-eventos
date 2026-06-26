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
    orden: campo.orden,
  }));

  return trx('campo_form').insert(filas).returning('*');
}

module.exports = { crearVarios };