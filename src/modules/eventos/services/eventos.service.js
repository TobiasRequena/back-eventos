const ExcelJS = require('exceljs');
const { db } = require('../../../config/db');
const eventosRepository = require('../repositories/eventos.repository');
const formulariosRepository = require('../../formularios/repositories/formularios.repository');
const talleresRepository = require('../../talleres/repositories/talleres.repository');
const archivosRepository = require('../../archivos/repositories/archivos.repository');
const participantesRepository = require('../../participantes/repositories/participantes.repository');
const pagosRepository = require('../../pagos/repositories/pagos.repository');
const { desencriptar } = require('../../../utils/encryption');
const { construirUrlPublica } = require('../../../utils/storage');
const { getOrSet, invalidar, invalidarPorPrefijo } = require('../../../utils/cache');
const sanitizarParticipante = require('../../../utils/sanitizarParticipante')
const calcularEdad = require('../../../utils/calcularEdad');

const ESTADO_PAGO_LABELS = {
  no_aplica: 'Sin costo',
  pendiente: 'Pendiente',
  pendiente_aprobacion: 'Comprobante enviado',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
};

/**
 * Crea un evento nuevo, junto con sus campos de formulario (si vienen),
 * todo en una sola transacción.
 *
 * Reglas de negocio que aplican acá:
 * 1. El código debe estar libre entre los eventos "activos" (fecha_fin futura) —
 *    no es un UNIQUE de columna, lo validamos a mano (ver eventos.repository.buscarActivoPorCodigo).
 * 2. RN07: el primer evento de una organización es gratis. Se determina
 *    contando eventos existentes ANTES de insertar este. Por ahora, solo
 *    calculamos y devolvemos esa info — el pago en sí (módulo `pagos`)
 *    todavía no existe, así que no disparamos ninguna creación de `pago` acá.
 */
async function crearEvento(orgId, usuarioId, datos) {
  return db.transaction(async (trx) => {
    // 1. Validar disponibilidad del código (entre eventos vigentes)
    const eventoConEseCodigo = await eventosRepository.buscarActivoPorCodigo(datos.codigo, trx);
    if (eventoConEseCodigo) {
      const error = new Error(
        'Ese código ya está en uso por un evento vigente. Probá otro código.'
      );
      error.status = 409;
      throw error;
    }

    // 2. Determinar si es el primer evento de la organización (RN07)
    const cantidadEventosPrevios = await eventosRepository.contarPorOrganizacion(orgId, trx);
    const esPrimerEvento = cantidadEventosPrevios === 0;

    // 3. Crear el evento
    const evento = await eventosRepository.crear(
      {
        orgId,
        creadoPorUsuarioId: usuarioId,
        nombre: datos.nombre,
        descripcion: datos.descripcion,
        codigo: datos.codigo,
        fechaInicio: datos.fechaInicio,
        fechaFin: datos.fechaFin,
        politicaMenor: datos.politicaMenor,
        tieneGrupos: datos.tieneGrupos,
        tieneTalleres: datos.tieneTalleres,
        cbuCvu: datos.cbuCvu,
        aliasCobro: datos.aliasCobro,
        costo: datos.costo,
        cupoMaximo: datos.cupoMaximo,
        requiereAutorizacionMenores: datos.requiereAutorizacionMenores,
        configFichaMedica: datos.configFichaMedica,
        configCertificado: datos.configCertificado,
        autorizacionTemplateUrl: datos.autorizacionTemplateUrl,
      },
      trx
    );

    invalidarPorPrefijo(`eventos:org:${orgId}`);

    // 4. Crear los campos de formulario, si vinieron
    const camposCreados = await formulariosRepository.crearVarios(
      evento.id,
      orgId,
      datos.camposForm,
      trx
    );

    const bloquesCreados = await talleresRepository.crearBloquesConTalleres(
      evento.id,
      orgId,
      datos.bloquesTaller,
      trx
    );

    let talleresCreados = [];
    if (datos.talleresSueltos?.length > 0) {
      talleresCreados = await talleresRepository.crearTalleresSueltos(
        evento.id,
        orgId,
        datos.talleresSueltos,
        trx
      );
    }

    return {
      evento,
      camposForm: camposCreados,
      // Informativo para el front: así puede mostrar un aviso tipo
      // "este evento es gratis" o "vas a tener que pagar la creación"
      // sin tener que calcularlo de nuevo del lado del cliente.
      // Cuando exista el módulo `pagos`, este flag es lo que va a disparar
      // la creación del registro de pago correspondiente.
      bloquesTaller: bloquesCreados,
      talleresSueltos: talleresCreados,
      esPrimerEventoGratis: esPrimerEvento,
    };
  });
}

/**
 * Lista los eventos de la organización activa (la del header X-Org-Id).
 */
/**
 * Lista los eventos de la organización activa, cada uno con su cantidad
 * de inscriptos (sin traer camposForm/talleres completos, para no
 * sobrecargar la respuesta del listado).
 *
 * PENDIENTE: cantidadInscriptos hardcodeado en 0 — mismo pendiente que
 * en obtenerEvento, hasta que exista el módulo participantes.
 */
async function listarEventos(orgId) {
  return getOrSet(`eventos:org:${orgId}`, async () => {
    const eventos = await eventosRepository.listarPorOrganizacion(orgId);

    return Promise.all(
      eventos.map(async (evento) => {
        const [portada, cantidadInscriptos, pagoPendiente] = await Promise.all([
          archivosRepository.buscarPortadaDeEvento(evento.id),
          participantesRepository.contarPorEvento(evento.id),
          pagosRepository.buscarPagoPendientePorEvento(evento.id),
        ]);

        return {
          ...evento,
          cantidadInscriptos,
          imagenUrl: construirUrlPublica(portada?.key),
          pagoPlataforma: pagoPendiente
            ? {
              estado: pagoPendiente.estado,
              monto: pagoPendiente.monto,
              pagoId: pagoPendiente.id,
            }
            : null,
        };
      })
    );
  });
}

/**
 * Busca un evento por id, verificando que pertenezca a la organización activa.
 * Esta verificación de pertenencia NO la hace el middleware (a diferencia de
 * organizaciones), porque el middleware resolverOrganizacionActiva solo sabe
 * el orgId del header — no sabe a qué organización pertenece el evento
 * que se está pidiendo por :id. Por eso se valida acá, comparando
 * evento.org_id con el orgId activo.
 */
/**
 * Busca un evento por id, con su detalle completo: campos_form, talleres,
 * y cantidad de inscriptos.
 *
 * PENDIENTE: cantidadInscriptos está hardcodeado en 0 porque el módulo
 * `participantes` todavía no existe. Cuando lo construyamos, reemplazar
 * esta línea por una query real (ej. contar filas de `participante`
 * con evento_id = este evento).
 */
async function obtenerEvento(id, orgId) {
  const evento = await eventosRepository.buscarPorId(id);

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

  const [camposForm, bloquesTaller, portada, cantidadInscriptos, pagoPendiente, talleresSueltos] = await Promise.all([
    formulariosRepository.listarPorEvento(evento.id),
    talleresRepository.listarBloquesPorEvento(evento.id),
    archivosRepository.buscarPortadaDeEvento(evento.id),
    participantesRepository.contarPorEvento(evento.id),
    pagosRepository.buscarPagoPendientePorEvento(evento.id),
    talleresRepository.listarTalleresSueltosPorEvento(evento.id),
  ]);

  return {
    ...evento,
    camposForm,
    bloquesTaller,
    talleresSueltos,
    cantidadInscriptos,
    imagenUrl: construirUrlPublica(portada?.key),
    pagoPlataforma: pagoPendiente
      ? {
        estado: pagoPendiente.estado,
        monto: pagoPendiente.monto,
        pagoId: pagoPendiente.id,
      }
      : null,
  };
}

/**
 * Edita un evento existente. Reusa obtenerEvento para la verificación
 * de pertenencia antes de actualizar.
 */
async function editarEvento(id, orgId, datos) {
  const evento = await obtenerEvento(id, orgId);
  invalidar(`evento:${id}`);
  invalidarPorPrefijo(`eventos:org:${orgId}`);

  const fechaInicioFinal = datos.fechaInicio ?? evento.fecha_inicio;
  const fechaFinFinal = datos.fechaFin ?? evento.fecha_fin;

  if (new Date(fechaFinFinal) < new Date(fechaInicioFinal)) {
    const error = new Error('fechaFin debe ser igual o posterior a fechaInicio');
    error.status = 400;
    throw error;
  }

  // Si se manda un código nuevo, validar que esté disponible
  // (no lo use otro evento vigente distinto a este)
  if (datos.codigo && datos.codigo !== evento.codigo) {
    const eventoConEseCodigo = await eventosRepository.buscarActivoPorCodigo(datos.codigo);
    if (eventoConEseCodigo && eventoConEseCodigo.id !== id) {
      const error = new Error('Ese código ya está en uso por un evento vigente');
      error.status = 409;
      throw error;
    }
  }

  const datosDb = {};
  if (datos.nombre !== undefined) datosDb.nombre = datos.nombre;
  if (datos.descripcion !== undefined) datosDb.descripcion = datos.descripcion;
  if (datos.codigo !== undefined) datosDb.codigo = datos.codigo;
  if (datos.fechaInicio !== undefined) datosDb.fecha_inicio = datos.fechaInicio;
  if (datos.fechaFin !== undefined) datosDb.fecha_fin = datos.fechaFin;
  if (datos.politicaMenor !== undefined) datosDb.politica_menor = datos.politicaMenor;
  if (datos.tieneGrupos !== undefined) datosDb.tiene_grupos = datos.tieneGrupos;
  if (datos.tieneTalleres !== undefined) datosDb.tiene_talleres = datos.tieneTalleres;
  if (datos.cbuCvu !== undefined) datosDb.cbu_cvu = datos.cbuCvu;
  if (datos.aliasCobro !== undefined) datosDb.alias_cobro = datos.aliasCobro;
  if (datos.costo !== undefined) datosDb.costo = datos.costo;
  if (datos.inscripcionesCerradas !== undefined) datosDb.inscripciones_cerradas = datos.inscripcionesCerradas;
  if (datos.cupoMaximo !== undefined) datosDb.cupo_maximo = datos.cupoMaximo;
  if (datos.requiereAutorizacionMenores !== undefined) datosDb.requiere_autorizacion_menores = datos.requiereAutorizacionMenores;
  if (datos.configFichaMedica !== undefined) datosDb.config_ficha_medica = datos.configFichaMedica;
  if (datos.configCertificado !== undefined) datosDb.config_certificado = datos.configCertificado;
  if (datos.autorizacionTemplateUrl !== undefined) datosDb.autorizacion_template_url = datos.autorizacionTemplateUrl;

  return eventosRepository.actualizar(id, datosDb);
}

/**
 * Elimina un evento, verificando pertenencia primero.
 */
async function eliminarEvento(id, orgId) {
  await obtenerEvento(id, orgId); // valida existencia + pertenencia, descarta el resultado
  await eventosRepository.eliminar(id);
  invalidar(`evento:${id}`);
  invalidarPorPrefijo(`eventos:org:${orgId}`);
}

/**
 * Busca un evento público por su código. Solo devuelve el evento si está
 * vigente (fecha_fin no pasó) — un código de un evento finalizado no
 * debería resolver a ese evento viejo para nadie que intente inscribirse.
 *
 * Este endpoint es público (sin autenticación) — lo va a usar el formulario
 * de inscripción que ve cualquier participante, no un Admin logueado.
 */
async function buscarPorCodigoPublico(codigo) {
  const evento = await eventosRepository.buscarActivoPorCodigo(codigo);

  if (!evento) {
    const error = new Error('No se encontró ningún evento vigente con ese código');
    error.status = 404;
    throw error;
  }

  // Traemos camposForm y bloquesTaller igual que en obtenerEvento,
  // porque el formulario de inscripción necesita esos datos para renderizarse.
  // No traemos cantidadInscriptos ni imagenUrl porque este endpoint es público
  // y no necesita esos datos para el flujo de inscripción.
  const [camposForm, bloquesTaller, portada, talleresSueltos] = await Promise.all([
    formulariosRepository.listarPorEvento(evento.id),
    talleresRepository.listarBloquesPorEvento(evento.id),
    archivosRepository.buscarPortadaDeEvento(evento.id),
    talleresRepository.listarTalleresSueltosPorEvento(evento.id),
  ]);

  return {
    ...evento,
    imagenUrl: portada ? construirUrlPublica(portada.key) : null,
    camposForm,
    bloquesTaller,
    talleresSueltos,
  };
}

/**
 * Verifica si un código de evento está disponible (no hay ningún evento
 * vigente con ese código). Requiere autenticación — solo usuarios logueados
 * (organizadores) deberían poder consultar esto, desde el formulario de
 * creación de eventos.
 *
 * Reutiliza buscarActivoPorCodigo: si devuelve algo, el código está ocupado;
 * si devuelve null/undefined, está libre.
 */
async function verificarDisponibilidadCodigo(codigo) {
  const eventoExistente = await eventosRepository.buscarActivoPorCodigo(codigo);
  return { disponible: !eventoExistente, eventoId: eventoExistente?.id || null };
}

/**
 * Calcula los KPIs del evento para el dashboard de administración.
 *
 * La parte más interesante es camposFormStats: como respuestas_form es un
 * JSONB en cada fila de participante (no una tabla separada), no podemos
 * hacer un GROUP BY directo en SQL. En cambio, traemos todas las respuestas
 * en memoria y las agrupamos con JavaScript.
 *
 * Esto es aceptable para el volumen esperado (hasta 15.000 inscriptos),
 * pero si en algún momento se vuelve lento, se puede migrar a una query
 * SQL con jsonb_each() de PostgreSQL que hace el grouping en la DB.
 */
async function obtenerStats(id, orgId) {
  const evento = await eventosRepository.buscarPorId(id);
  if (!evento) { const error = new Error('Evento no encontrado'); error.status = 404; throw error; }
  if (evento.org_id !== orgId) { const error = new Error('No tenés permisos'); error.status = 403; throw error; }

  const [totalInscriptos, bloques, campos, filas, talleresSueltos, resumenPagos, kpisFicha, cantidadAcreditados] = await Promise.all([
    eventosRepository.contarInscriptos(id),
    talleresRepository.listarBloquesPorEvento(id),
    formulariosRepository.listarPorEvento(id),
    eventosRepository.listarRespuestasForm(id),
    talleresRepository.listarTalleresSueltosPorEvento(id),
    eventosRepository.resumenPagos(id),
    eventosRepository.kpisFichaMedica(id),
    eventosRepository.contarAcreditados(id), // ← nuevo
  ]);

  // Bloques con conteo de inscriptos por taller
  const bloquesConStats = await Promise.all(
    bloques.map(async (bloque) => ({
      id: bloque.id,
      nombre: bloque.nombre,
      inicio: bloque.inicio,
      fin: bloque.fin,
      cantidad_elegible: bloque.cantidad_elegible,
      es_obligatorio: bloque.es_obligatorio,
      talleres: await Promise.all(
        bloque.talleres.map(async (taller) => ({
          id: taller.id,
          nombre: taller.nombre,
          capacidad: taller.capacidad,
          inscriptos: await eventosRepository.contarInscriptosPorTaller(taller.id),
        }))
      ),
    }))
  );

  // Talleres sueltos con conteo
  const talleresSueltosConStats = await Promise.all(
    talleresSueltos.map(async (taller) => ({
      id: taller.id,
      nombre: taller.nombre,
      inicio: taller.inicio,
      fin: taller.fin,
      capacidad: taller.capacidad,
      es_obligatorio: taller.es_obligatorio,
      inscriptos: await eventosRepository.contarInscriptosPorTaller(taller.id),
    }))
  );

  // Campos de formulario
  const TIPOS_CON_STATS = ['seleccion', 'booleano', 'texto', 'numero', 'fecha'];
  const camposFormStats = campos
    .filter((campo) => TIPOS_CON_STATS.includes(campo.tipo))
    .map((campo) => {
      const valores = [];
      for (const fila of filas) {
        const respuestas = fila.respuestas_form || {};
        const valor = respuestas[campo.id];
        if (valor === undefined || valor === null || valor === '') continue;
        valores.push(valor);
      }
      const totalRespuestas = valores.length;
      let stats = {};
      switch (campo.tipo) {
        case 'seleccion':
        case 'booleano': {
          const conteo = {};
          for (const v of valores) {
            const clave = String(v);
            conteo[clave] = (conteo[clave] || 0) + 1;
          }
          stats.respuestasPopulares = Object.entries(conteo)
            .map(([valor, cantidad]) => ({ valor, cantidad }))
            .sort((a, b) => b.cantidad - a.cantidad);
          break;
        }
        case 'texto': {
          const conteo = {};
          for (const v of valores) {
            const clave = String(v).trim().toLowerCase()
              .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            conteo[clave] = (conteo[clave] || 0) + 1;
          }
          stats.respuestasFrecuentes = Object.entries(conteo)
            .map(([valor, cantidad]) => ({ valor, cantidad }))
            .sort((a, b) => b.cantidad - a.cantidad);
          break;
        }
        case 'numero': {
          const nums = valores.map(Number).filter((n) => !isNaN(n));
          if (nums.length > 0) {
            stats.promedio = Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
            stats.minimo = Math.min(...nums);
            stats.maximo = Math.max(...nums);
          }
          break;
        }
        case 'fecha': {
          const fechas = valores.map((v) => new Date(v)).filter((d) => !isNaN(d));
          if (fechas.length > 0) {
            stats.minimo = new Date(Math.min(...fechas)).toISOString().split('T')[0];
            stats.maximo = new Date(Math.max(...fechas)).toISOString().split('T')[0];
          }
          break;
        }
      }
      return { id: campo.id, etiqueta: campo.etiqueta, tipo: campo.tipo, totalRespuestas, ...stats };
    });

  return {
    cupoMaximo: evento.cupo_maximo,
    totalInscriptos,
    cantidadAcreditados,
    bloquesTaller: bloquesConStats,
    talleresSueltos: talleresSueltosConStats,
    resumenPagos,
    kpisFichaMedica: kpisFicha,
    camposFormStats,
  };
}

async function generarExcelInscriptos(id, orgId) {
  const evento = await eventosRepository.buscarPorId(id);
  if (!evento) { const error = new Error('Evento no encontrado'); error.status = 404; throw error; }
  if (evento.org_id !== orgId) { const error = new Error('No tenés permisos'); error.status = 403; throw error; }

  const campos = await formulariosRepository.listarPorEvento(id);
  const participantes = await eventosRepository.listarInscriptosCompleto(id);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Talita Encuentros';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Inscriptos');
  const COL_START = 2;
  const HEADER_ROW = 2;
  const DATA_START_ROW = 3;

  // ← Columnas condicionales según configuración del evento
  const columnasReales = [
    { header: 'Apellido', key: 'apellido' },
    { header: 'Nombre', key: 'nombre' },
    { header: 'DNI', key: 'dni' },
    { header: 'Email', key: 'email' },
    { header: 'Fecha de nacimiento', key: 'nacimiento' },
    { header: 'Edad', key: 'edad' },
    { header: 'Estado de pago', key: 'estado_pago' },
    // Solo si tiene grupos
    ...(evento.tiene_grupos ? [{ header: 'Grupo', key: 'grupo_nombre' }] : []),
    { header: 'Acreditado', key: 'acreditado' },
    // Solo si tiene talleres
    ...(evento.tiene_talleres ? [{ header: 'Talleres', key: 'talleres' }] : []),
    ...campos.map((c) => ({ header: c.etiqueta, key: `campo_${c.id}` })),
  ];

  sheet.columns = [
    { key: '_spacer', width: 3 },
    ...columnasReales.map(({ key }) => ({ key })),
  ];

  sheet.views = [{ state: 'frozen', ySplit: HEADER_ROW }];

  const lastCol = COL_START + columnasReales.length - 1;
  const lastRow = participantes.length
    ? DATA_START_ROW + participantes.length - 1
    : HEADER_ROW;

  sheet.autoFilter = {
    from: { row: HEADER_ROW, column: COL_START },
    to: { row: HEADER_ROW, column: lastCol },
  };

  const BORDE = { style: 'thin', color: { argb: 'FF000000' } };
  const BORDE_GRUESO = { style: 'medium', color: { argb: 'FF000000' } };

  // ===== HEADER (fila 2) =====
  columnasReales.forEach((col, i) => {
    const cell = sheet.getCell(HEADER_ROW, COL_START + i);
    cell.value = col.header;
    cell.font = { bold: true };
    cell.border = { top: BORDE, left: BORDE, right: BORDE, bottom: BORDE };
  });

  // ===== DATOS (desde fila 3) =====
  participantes.forEach((p, idx) => {
    const respuestas = p.respuestas_form || {};
    const rowNumber = DATA_START_ROW + idx;
    const row = sheet.getRow(rowNumber);

    let dniLegible = p.dni;
    try { dniLegible = desencriptar(p.dni); } catch { }

    const fila = {
      apellido: p.apellido,
      nombre: p.nombre,
      dni: dniLegible,
      email: p.email,
      nacimiento: p.nacimiento ? new Date(p.nacimiento) : null,
      edad: calcularEdad(p.nacimiento),
      estado_pago: ESTADO_PAGO_LABELS[p.estado_pago] ?? p.estado_pago,
      // Solo si tiene grupos
      ...(evento.tiene_grupos ? { grupo_nombre: p.grupo_nombre ?? 'Individual' } : {}),
      acreditado: p.acreditado ? 'Sí' : 'No',
      // Solo si tiene talleres — todos los talleres separados por ' / '
      ...(evento.tiene_talleres ? { talleres: p.talleres.join(' / ') } : {}),
    };

    for (const campo of campos) {
      const valor = respuestas[campo.id];
      fila[`campo_${campo.id}`] = valor === true ? 'Sí' : valor === false ? 'No' : valor ?? '';
    }

    columnasReales.forEach((col, i) => {
      const cell = row.getCell(COL_START + i);
      cell.value = fila[col.key] ?? null;
      cell.border = { left: BORDE, right: BORDE };
      if (rowNumber % 2 === 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };
      }
    });
  });

  const idxNacimiento = columnasReales.findIndex(c => c.key === 'nacimiento');
  if (idxNacimiento >= 0) {
    sheet.getColumn(COL_START + idxNacimiento).numFmt = 'dd/mm/yyyy';
  }

  // ===== ANCHO AUTOMÁTICO (solo columnas reales, desde B) =====
  const MIN_WIDTH = 10;
  const MAX_WIDTH = 55;

  columnasReales.forEach((col, i) => {
    const colIndex = COL_START + i;
    let maxLen = col.header.length;

    sheet.getColumn(colIndex).eachCell({ includeEmpty: false }, (cell, rowNumber) => {
      if (rowNumber === HEADER_ROW) return;
      const valor = cell.value;
      const largo = valor instanceof Date ? 10 : String(valor ?? '').length;
      if (largo > maxLen) maxLen = largo;
    });

    sheet.getColumn(colIndex).width = Math.min(Math.max(maxLen + 4, MIN_WIDTH), MAX_WIDTH);
  });

  // ===== BORDE GRUESO PERIMETRAL =====
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
    nombreArchivo: `inscriptos_${evento.codigo}.xlsx`,
  };
}

async function obtenerStatsInscripciones(orgId, rango = '7d') {
  // Parsear el rango
  const dias = {
    '7d': 7,
    '14d': 14,
    '30d': 30,
  }[rango];

  if (!dias) {
    const error = new Error('Rango inválido. Usá 7d, 14d o 30d');
    error.status = 400;
    throw error;
  }

  const hoy = new Date();
  const fechaFin = new Date(hoy);
  fechaFin.setHours(23, 59, 59, 999);

  const fechaInicio = new Date(hoy);
  fechaInicio.setDate(fechaInicio.getDate() - (dias - 1));
  fechaInicio.setHours(0, 0, 0, 0);

  // Traer los días con inscripciones de la DB
  const resultadosDb = await eventosRepository.contarInscripcionesPorDia(
    orgId,
    fechaInicio,
    fechaFin
  );

  // Construir un mapa { 'YYYY-MM-DD': cantidad }
  const mapaDb = {};
  for (const fila of resultadosDb) {
    const fecha = new Date(fila.fecha).toISOString().split('T')[0];
    mapaDb[fecha] = Number(fila.inscripciones);
  }

  // Generar todos los días del rango, rellenando con 0 los que no tienen inscripciones
  const datos = [];
  let total = 0;

  for (let i = dias - 1; i >= 0; i--) {
    const fecha = new Date(hoy);
    fecha.setDate(fecha.getDate() - i);
    const fechaStr = fecha.toISOString().split('T')[0];
    const inscripciones = mapaDb[fechaStr] ?? 0;

    datos.push({ fecha: fechaStr, inscripciones });
    total += inscripciones;
  }

  return { datos, total };
}

/**
 * Verifica si un evento está cerrado para inscripciones y acreditaciones.
 * Se cierra si:
 * 1. El admin lo cerró manualmente (inscripciones_cerradas = true)
 * 2. La fecha_fin + 2hs ya pasó
 */
function eventoEstaCerrado(evento) {
  if (evento.inscripciones_cerradas) return true;
  const fechaCierre = new Date(evento.fecha_fin);
  fechaCierre.setHours(fechaCierre.getHours() + 2);
  return new Date() > fechaCierre;
}

async function listarPendientesPago(id, orgId) {
  const evento = await eventosRepository.buscarPorId(id);
  if (!evento) { const error = new Error('Evento no encontrado'); error.status = 404; throw error; }
  if (evento.org_id !== orgId) { const error = new Error('No tenés permisos'); error.status = 403; throw error; }

  const participantes = await participantesRepository.listarPorEvento(id, { estadoPago: 'pendiente_aprobacion' });
  return participantes.map(p => sanitizarParticipante(p, 'admin'));
}

async function listarFichasMedicas(id, orgId) {
  const evento = await eventosRepository.buscarPorId(id);
  if (!evento) { const error = new Error('Evento no encontrado'); error.status = 404; throw error; }
  if (evento.org_id !== orgId) { const error = new Error('No tenés permisos'); error.status = 403; throw error; }

  return eventosRepository.listarFichasMedicasRelevantes(id);
}

module.exports = {
  crearEvento,
  listarEventos,
  obtenerEvento,
  editarEvento,
  eliminarEvento,
  buscarPorCodigoPublico,
  verificarDisponibilidadCodigo,
  obtenerStats,
  generarExcelInscriptos,
  obtenerStatsInscripciones,
  eventoEstaCerrado,
  listarPendientesPago,
  listarFichasMedicas,
};