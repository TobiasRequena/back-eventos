const { db } = require('../../../config/db');
const talleresRepository = require('../repositories/talleres.repository');
const eventosRepository = require('../../eventos/repositories/eventos.repository');
const ExcelJS = require('exceljs');
const { desencriptar } = require('../../../utils/encryption');
const { calcularEdad } = require('../../participantes/services/participantes.service');
const { getOrSet, invalidar, invalidarPorPrefijo } = require('../../../utils/cache');

const ESTADO_PAGO_LABELS = {
  no_aplica: 'Sin costo',
  pendiente: 'Pendiente',
  pendiente_aprobacion: 'Comprobante enviado',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
};

/**
 * Verifica que un evento exista y pertenezca a la organización activa.
 */
async function verificarEventoDeLaOrg(eventoId, orgId, trx = db) {
  const evento = await eventosRepository.buscarPorId(eventoId, trx);

  if (!evento) {
    const error = new Error('Evento no encontrado');
    error.status = 404;
    throw error;
  }

  if (evento.org_id !== orgId) {
    const error = new Error('No tenés permisos sobre este evento');
    error.status = 403;
    throw error;
  }

  return evento;
}

// ---------- bloque_taller ----------

/**
 * Crea un bloque standalone (fuera del flujo de creación conjunta del evento),
 * con sus talleres internos, en una transacción.
 */
async function crearBloque(eventoId, orgId, datos) {
  return db.transaction(async (trx) => {
    await verificarEventoDeLaOrg(eventoId, orgId, trx);

    const [bloqueCreado] = await talleresRepository.crearBloquesConTalleres(
      eventoId,
      orgId,
      [datos], // crearBloquesConTalleres espera un array, le mandamos uno solo
      trx
    );

    return bloqueCreado;
  });
}

/**
 * Lista los bloques (con sus talleres anidados) de un evento.
 */
async function listarBloques(eventoId, orgId) {
  return getOrSet(`bloques:${eventoId}`, async () => {
    await verificarEventoDeLaOrg(eventoId, orgId);
    return talleresRepository.listarBloquesPorEvento(eventoId);
  });
}

/**
 * Busca un bloque por id, verificando pertenencia a la organización.
 */
async function obtenerBloque(id, orgId) {
  const bloque = await talleresRepository.buscarBloquePorId(id);

  if (!bloque) {
    const error = new Error('Bloque no encontrado');
    error.status = 404;
    throw error;
  }

  if (bloque.org_id !== orgId) {
    const error = new Error('No tenés permisos sobre este bloque');
    error.status = 403;
    throw error;
  }

  return bloque;
}

/**
 * Edita los datos de un bloque (nombre, cantidad_elegible, es_obligatorio, orden).
 * No toca los talleres internos — eso se maneja por separado, agregando/quitando
 * talleres individuales dentro del bloque.
 */
async function editarBloque(id, orgId, datos) {
  const bloque = await obtenerBloque(id, orgId); // ← ya tenemos el bloque
  const datosDb = {};
  if (datos.nombre !== undefined) datosDb.nombre = datos.nombre;
  if (datos.cantidadElegible !== undefined) datosDb.cantidad_elegible = datos.cantidadElegible;
  if (datos.esObligatorio !== undefined) datosDb.es_obligatorio = datos.esObligatorio;
  if (datos.orden !== undefined) datosDb.orden = datos.orden;
  if (datos.inicio !== undefined) datosDb.inicio = datos.inicio;
  if (datos.fin !== undefined) datosDb.fin = datos.fin;
  invalidarPorPrefijo(`bloques:${bloque.evento_id}`); // ← usar bloque.evento_id
  invalidarPorPrefijo(`participantes:evento:${bloque.evento_id}`);
  return talleresRepository.actualizarBloque(id, datosDb);
}

/**
 * Elimina un bloque. Como taller.bloque_taller_id es NOT NULL sin CASCADE,
 * PostgreSQL va a rechazar el DELETE si todavía tiene talleres adentro —
 * acá lo detectamos antes para dar un mensaje claro en vez del error
 * crudo de foreign key violation.
 */
async function eliminarBloque(id, orgId) {
  const bloque = await obtenerBloque(id, orgId);
  const talleresDelBloque = await talleresRepository.listarBloquesPorEvento(bloque.evento_id);
  const esteBloque = talleresDelBloque.find((b) => b.id === id);
  if (esteBloque && esteBloque.talleres.length > 0) {
    const error = new Error('No se puede eliminar un bloque que todavía tiene talleres.');
    error.status = 409; throw error;
  }
  invalidarPorPrefijo(`bloques:${bloque.evento_id}`); // ← usar bloque.evento_id
  invalidarPorPrefijo(`participantes:evento:${bloque.evento_id}`);
  await talleresRepository.eliminarBloque(id);
}

// ---------- taller ----------

/**
 * Crea un taller suelto dentro de un bloque ya existente
 * (ej. "agregale otro horario/opción a este bloque").
 */
async function crearTallerEnBloque(bloqueId, orgId, datos) {
  const bloque = await obtenerBloque(bloqueId, orgId);
  return talleresRepository.crearEnBloque(bloque, datos);
}

/**
 * Busca un taller por id, verificando pertenencia a la organización.
 */
async function obtenerTaller(id, orgId) {
  const taller = await talleresRepository.buscarPorId(id);

  if (!taller) {
    const error = new Error('Taller no encontrado');
    error.status = 404;
    throw error;
  }

  if (taller.org_id !== orgId) {
    const error = new Error('No tenés permisos sobre este taller');
    error.status = 403;
    throw error;
  }

  return taller;
}

/**
 * Edita un taller individual.
 */
async function editarTaller(id, orgId, datos) {
  const taller = await obtenerTaller(id, orgId);

  // Solo validar inicio/fin si el taller es suelto (sin bloque)
  // o si se están editando las fechas
  if (!taller.bloque_taller_id || datos.inicio || datos.fin) {
    const inicioFinal = datos.inicio ?? taller.inicio;
    const finFinal = datos.fin ?? taller.fin;
    if (inicioFinal && finFinal && new Date(finFinal) <= new Date(inicioFinal)) {
      const error = new Error('fin debe ser posterior a inicio');
      error.status = 400; throw error;
    }
  }

  const datosDb = {};
  if (datos.nombre !== undefined) datosDb.nombre = datos.nombre;
  if (datos.descripcion !== undefined) datosDb.descripcion = datos.descripcion;
  if (datos.inicio !== undefined) datosDb.inicio = datos.inicio;
  if (datos.fin !== undefined) datosDb.fin = datos.fin;
  if (datos.capacidad !== undefined) datosDb.capacidad = datos.capacidad;
  if (datos.lugarId !== undefined) datosDb.lugar_id = datos.lugarId;
  if (datos.esObligatorio !== undefined) datosDb.es_obligatorio = datos.esObligatorio;

  invalidarPorPrefijo(`bloques:${taller.evento_id}`);
  return talleresRepository.actualizar(id, datosDb);
}

/**
 * Elimina un taller individual. A diferencia de eliminar un bloque entero,
 * esto sí está permitido libremente (un bloque puede quedar con menos
 * talleres, mientras tenga al menos uno para seguir teniendo sentido —
 * esa validación de "al menos uno" la dejamos para el front por ahora,
 * no la forzamos acá).
 */
async function eliminarTaller(id, orgId) {
  await obtenerTaller(id, orgId);
  await talleresRepository.eliminar(id);
}

async function crearTallerSuelto(eventoId, orgId, datos) {
  await verificarEventoDeLaOrg(eventoId, orgId);

  const [taller] = await db('taller').insert({
    org_id: orgId,
    evento_id: eventoId,
    nombre: datos.nombre,
    descripcion: datos.descripcion ?? null,
    inicio: datos.inicio,
    fin: datos.fin,
    capacidad: datos.capacidad ?? null,
    lugar_id: datos.lugarId ?? null,
    bloque_taller_id: null,
    es_obligatorio: datos.esObligatorio ?? false,
  }).returning('*');

  invalidarPorPrefijo(`bloques:${eventoId}`);
  return taller;
}

async function listarInscriptos(tallerId, orgId) {
  await obtenerTaller(tallerId, orgId);
  return talleresRepository.listarInscriptos(tallerId);
}

/**
 * Asigna un participante a un taller.
 *
 * Reglas de negocio:
 * - No se puede asignar dos veces al mismo taller.
 * - Si el taller tiene capacidad definida, no se puede superar el cupo.
 * - REGLA NUEVA (según MODELO_DATOS.md, sección "Reglas que NO están en la base"):
 *   la cantidad de talleres que el participante puede tener dentro del MISMO
 *   bloque_taller no puede superar cantidad_elegible. Si es_obligatorio = true,
 *   no se valida acá el mínimo exacto (eso se valida recién al cerrar la
 *   inscripción completa, en el módulo participantes) — acá solo evitamos
 *   que se pase del máximo permitido.
 */
async function asignarParticipante(tallerId, orgId, participanteId) {
  return db.transaction(async (trx) => {
    const taller = await talleresRepository.buscarPorId(tallerId, trx);
    if (!taller) {
      const error = new Error('Taller no encontrado');
      error.status = 404;
      throw error;
    }
    if (taller.org_id !== orgId) {
      const error = new Error('No tenés permisos sobre este taller');
      error.status = 403;
      throw error;
    }

    const inscripcionExistente = await talleresRepository.buscarInscripcion(
      participanteId,
      tallerId,
      trx
    );
    if (inscripcionExistente) {
      const error = new Error('El participante ya está inscripto a este taller');
      error.status = 409;
      throw error;
    }

    if (taller.capacidad !== null) {
      const inscriptos = await talleresRepository.contarInscriptos(tallerId, trx);
      if (inscriptos >= taller.capacidad) {
        const error = new Error('El taller ya alcanzó su capacidad máxima');
        error.status = 409;
        throw error;
      }
    }

    // Reemplazá el bloque de validación del bloque:
    if (taller.bloque_taller_id) {
      const bloque = await talleresRepository.buscarBloquePorId(taller.bloque_taller_id, trx);
      const yaElegidos = await talleresRepository.contarInscripcionesDelParticipanteEnBloque(
        participanteId,
        bloque.id,
        trx
      );
      if (yaElegidos >= bloque.cantidad_elegible) {
        const error = new Error(
          `Ya elegiste el máximo de talleres permitidos para el bloque "${bloque.nombre}" (${bloque.cantidad_elegible})`
        );
        error.status = 409; throw error;
      }
    }

    return talleresRepository.asignarParticipante({ participanteId, tallerId, orgId }, trx);
  });
}

async function desasignarParticipante(tallerId, orgId, participanteId) {
  const taller = await obtenerTaller(tallerId, orgId);

  const inscripcion = await talleresRepository.buscarInscripcion(participanteId, taller.id);
  if (!inscripcion) {
    const error = new Error('Ese participante no está inscripto a este taller');
    error.status = 404;
    throw error;
  }

  await talleresRepository.desasignarParticipante(participanteId, taller.id);
}

async function generarExcelTaller(tallerId, orgId) {
  const taller = await talleresRepository.buscarPorId(tallerId);
  if (!taller) {
    const error = new Error('Taller no encontrado'); error.status = 404; throw error;
  }
  if (taller.org_id !== orgId) {
    const error = new Error('No tenés permisos sobre este taller'); error.status = 403; throw error;
  }

  const evento = await eventosRepository.buscarPorId(taller.evento_id);

  const inscriptos = await talleresRepository.listarInscriptos(tallerId);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Talita Encuentros';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Participantes');

  const COL_START = 2;
  const HEADER_ROW = 2;
  const DATA_START_ROW = 3;
  const BORDE = { style: 'thin', color: { argb: 'FF000000' } };
  const BORDE_GRUESO = { style: 'medium', color: { argb: 'FF000000' } };
  const MIN_WIDTH = 10;
  const MAX_WIDTH = 55;

  const columnas = [
    { header: 'Apellido', key: 'apellido' },
    { header: 'Nombre', key: 'nombre' },
    { header: 'DNI', key: 'dni' },
    { header: 'Fecha de nacimiento', key: 'nacimiento' },
    { header: 'Edad', key: 'edad' },
    { header: 'Estado de pago', key: 'estado_pago' },
    { header: 'Acreditado', key: 'acreditado' },
  ];

  sheet.columns = [
    { key: '_spacer', width: 3 },
    ...columnas.map(({ key }) => ({ key })),
  ];

  sheet.views = [{ state: 'frozen', ySplit: HEADER_ROW }];

  const lastCol = COL_START + columnas.length - 1;
  const lastRow = inscriptos.length ? DATA_START_ROW + inscriptos.length - 1 : HEADER_ROW;

  sheet.autoFilter = {
    from: { row: HEADER_ROW, column: COL_START },
    to: { row: HEADER_ROW, column: lastCol },
  };

  // Headers
  columnas.forEach((col, i) => {
    const cell = sheet.getCell(HEADER_ROW, COL_START + i);
    cell.value = col.header;
    cell.font = { bold: true };
    cell.border = { top: BORDE, left: BORDE, right: BORDE, bottom: BORDE };
    cell.alignment = { horizontal: 'center' };
  });

  // Datos
  inscriptos.forEach((p, idx) => {
    let dniLegible = p.dni;
    try { dniLegible = desencriptar(p.dni); } catch { }

    const rowNumber = DATA_START_ROW + idx;
    const row = sheet.getRow(rowNumber);

    // Necesitamos el checkin — lo traemos aparte
    const fila = {
      apellido: p.apellido,
      nombre: p.nombre,
      dni: dniLegible,
      nacimiento: p.nacimiento ? new Date(p.nacimiento) : null,
      edad: calcularEdad(p.nacimiento),
      estado_pago: ESTADO_PAGO_LABELS[p.estado_pago] ?? p.estado_pago,
      acreditado: p.acreditado ? 'Sí' : 'No',
    };

    columnas.forEach((col, i) => {
      const cell = row.getCell(COL_START + i);
      cell.value = fila[col.key] ?? null;
      cell.border = { left: BORDE, right: BORDE };
      if (rowNumber % 2 === 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };
      }
    });
  });

  const idxNacimiento = columnas.findIndex(c => c.key === 'nacimiento');
  if (idxNacimiento >= 0) sheet.getColumn(COL_START + idxNacimiento).numFmt = 'dd/mm/yyyy';

  // Ancho automático
  columnas.forEach((col, i) => {
    const colIndex = COL_START + i;
    let maxLen = col.header.length;
    sheet.getColumn(colIndex).eachCell({ includeEmpty: false }, (cell, rowNum) => {
      if (rowNum === HEADER_ROW) return;
      const valor = cell.value;
      const largo = valor instanceof Date ? 10 : String(valor ?? '').length;
      if (largo > maxLen) maxLen = largo;
    });
    sheet.getColumn(colIndex).width = Math.min(Math.max(maxLen + 4, MIN_WIDTH), MAX_WIDTH);
  });

  // Borde grueso perimetral
  for (let r = HEADER_ROW; r <= lastRow; r++) {
    for (let c = COL_START; c <= lastCol; c++) {
      const cell = sheet.getCell(r, c);
      const actual = cell.border || {};
      cell.border = {
        top: r === HEADER_ROW ? BORDE_GRUESO : actual.top,
        bottom: r === lastRow ? BORDE_GRUESO : actual.bottom,
        left: c === COL_START ? BORDE_GRUESO : actual.left,
        right: c === lastCol ? BORDE_GRUESO : actual.right,
      };
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return {
    buffer,
    nombreArchivo: `taller_${taller.nombre.replace(/\s+/g, '_')}_${evento.codigo}.xlsx`,
  };
}

module.exports = {
  crearBloque,
  listarBloques,
  obtenerBloque,
  editarBloque,
  eliminarBloque,
  crearTallerEnBloque,
  obtenerTaller,
  editarTaller,
  eliminarTaller,
  crearTallerSuelto,
  listarInscriptos,
  asignarParticipante,
  desasignarParticipante,
  generarExcelTaller
};