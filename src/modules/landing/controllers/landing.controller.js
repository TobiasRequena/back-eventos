const { v4: uuidv4 } = require('uuid');
const landingRepository = require('../repositories/landing.repository');
const eventosRepository = require('../../eventos/repositories/eventos.repository');
const archivosRepository = require('../../archivos/repositories/archivos.repository');
const archivosService = require('../../archivos/services/archivos.service');
const { construirUrlPublica } = require('../../../utils/storage');
const { getOrSet, invalidar } = require('../../../utils/cache');
const { db } = require('../../../config/db');
const { enviarMail } = require('../../../utils/mail');
const { templateGaleriaHabilitada } = require('../../../utils/mailTemplates');

const MAX_FOTOS_GALERIA = 20;

// ponytail: caché de 5 min en el server y en el navegador; los cambios de las orgs tardan hasta 5 min en verse
function publico(res, datos) {
  res.set('Cache-Control', 'public, max-age=300').status(200).json(datos);
}

/** GET /api/v1/landing/eventos */
async function listarEventos(req, res, next) {
  try {
    const filas = await getOrSet('landing', 'eventos', () => landingRepository.listarEventosPublicos());
    publico(res, {
      eventos: filas.map((e) => ({
        codigo: e.codigo,
        nombre: e.nombre,
        fecha_inicio: e.fecha_inicio,
        org: { nombre: e.org_nombre, logo_url: e.org_logo_url },
      })),
    });
  } catch (error) {
    next(error);
  }
}

/** GET /api/v1/landing/organizaciones */
async function listarOrganizaciones(req, res, next) {
  try {
    const organizaciones = await getOrSet('landing', 'organizaciones', () =>
      landingRepository.listarOrganizacionesPublicas()
    );
    publico(res, { organizaciones });
  } catch (error) {
    next(error);
  }
}

/** GET /api/v1/landing/galeria */
async function listarGaleria(req, res, next) {
  try {
    const eventos = await getOrSet('landing', 'galeria', () => landingRepository.listarGaleriaPublica());
    publico(res, {
      eventos: eventos.map((e) => ({
        nombre: e.nombre,
        fecha_inicio: e.fecha_inicio,
        org_nombre: e.org_nombre,
        fotos: e.fotos.map((f) => construirUrlPublica(f.key)),
      })),
    });
  } catch (error) {
    next(error);
  }
}

/** POST /api/v1/landing/sugerencias */
async function crearSugerencia(req, res, next) {
  try {
    await landingRepository.crearSugerencia(req.body.texto);
    res.status(201).json({ ok: true });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/landing/me-interesa
 * Con sesión, el voto se cuenta una sola vez por usuario. Sin sesión, el
 * navegador recuerda lo que marcó (localStorage) y el voto se cuenta siempre.
 */
async function marcarMeInteresa(req, res, next) {
  try {
    const { funcion } = req.body;
    await db.transaction(async (trx) => {
      const contar = req.usuario ? await landingRepository.marcarDeUsuario(req.usuario.sub, funcion, trx) : true;
      if (contar) await landingRepository.sumarVoto(funcion, 1, trx);
    });
    res.status(200).json({ ok: true });
  } catch (error) {
    next(error);
  }
}

/** DELETE /api/v1/landing/me-interesa/:funcion */
async function quitarMeInteresa(req, res, next) {
  try {
    const { funcion } = req.params;
    await db.transaction(async (trx) => {
      const descontar = req.usuario
        ? await landingRepository.desmarcarDeUsuario(req.usuario.sub, funcion, trx)
        : true;
      if (descontar) await landingRepository.sumarVoto(funcion, -1, trx);
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/landing/me-interesa/sincronizar
 * Pasa al usuario los me gusta que marcó antes de iniciar sesión (no suma
 * votos: ya se contaron sin sesión) y devuelve todos los suyos.
 */
async function sincronizarMeInteresa(req, res, next) {
  try {
    for (const funcion of new Set(req.body.funciones)) {
      await landingRepository.marcarDeUsuario(req.usuario.sub, funcion);
    }
    res.status(200).json({ funciones: await landingRepository.listarDeUsuario(req.usuario.sub) });
  } catch (error) {
    next(error);
  }
}

// ── Galería: la organización carga las fotos de sus eventos terminados ──

async function eventoDeLaOrg(eventoId, orgId) {
  const evento = await eventosRepository.buscarPorId(eventoId);
  if (!evento || evento.org_id !== orgId) {
    const error = new Error('Evento no encontrado');
    error.status = 404;
    throw error;
  }
  return evento;
}

/** GET /api/v1/eventos/:id/galeria */
async function listarFotosEvento(req, res, next) {
  try {
    await eventoDeLaOrg(req.params.id, req.orgId);
    const fotos = await landingRepository.listarFotosGaleria([req.params.id]);
    res.status(200).json({ fotos: fotos.map((f) => ({ id: f.id, url: construirUrlPublica(f.key) })) });
  } catch (error) {
    next(error);
  }
}

/** POST /api/v1/eventos/:id/galeria (multipart, campo "archivo") */
async function subirFotoEvento(req, res, next) {
  try {
    const evento = await eventoDeLaOrg(req.params.id, req.orgId);

    if (!req.file) {
      const error = new Error('No se recibió ningún archivo');
      error.status = 400;
      throw error;
    }
    if (new Date(evento.fecha_fin) >= new Date()) {
      const error = new Error('Las fotos se cargan cuando el evento terminó');
      error.status = 400;
      throw error;
    }
    if ((await landingRepository.contarFotosGaleria(evento.id)) >= MAX_FOTOS_GALERIA) {
      const error = new Error(`La galería admite hasta ${MAX_FOTOS_GALERIA} fotos por evento`);
      error.status = 400;
      throw error;
    }

    const key = `${landingRepository.PREFIJO_GALERIA}${uuidv4()}.webp`;
    const sizeBytes = await archivosService.subirImagen(req.file, key);
    const archivo = await archivosRepository.crear({
      orgId: evento.org_id,
      eventoId: evento.id,
      subidoPorUsuarioId: req.usuario.sub,
      key,
      nombreOriginal: req.file.originalname,
      mimeType: 'image/webp',
      sizeBytes,
    });
    invalidar('landing');

    res.status(201).json({ foto: { id: archivo.id, url: construirUrlPublica(key) } });
  } catch (error) {
    next(error);
  }
}

/** DELETE /api/v1/eventos/:id/galeria/:archivoId */
async function eliminarFotoEvento(req, res, next) {
  try {
    await eventoDeLaOrg(req.params.id, req.orgId);
    const foto = await landingRepository.buscarFotoGaleria(req.params.id, req.params.archivoId);
    if (!foto) {
      const error = new Error('Foto no encontrada');
      error.status = 404;
      throw error;
    }
    await archivosService.eliminarArchivo(foto.id);
    invalidar('landing');
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

/**
 * Tarea periódica (server.js): avisa por mail a los admins de cada evento
 * terminado que ya pueden subir las fotos. Si no salió ningún mail, el evento
 * queda pendiente y se reintenta en la próxima vuelta.
 */
async function avisarGaleriasHabilitadas() {
  const filas = await landingRepository.listarEventosParaAvisarGaleria();
  const porEvento = new Map();
  for (const f of filas) {
    if (!porEvento.has(f.evento_id)) porEvento.set(f.evento_id, []);
    porEvento.get(f.evento_id).push(f);
  }

  let avisados = 0;
  for (const [eventoId, admins] of porEvento) {
    const link = `${process.env.FRONTEND_URL}/eventos/${eventoId}/detalle?tab=galeria`;
    let alguno = false;
    for (const admin of admins) {
      const { subject, html } = templateGaleriaHabilitada({ nombre: admin.nombre, evento: { nombre: admin.evento_nombre }, link });
      const resultado = await enviarMail({ to: admin.email, subject, html });
      if (resultado.ok) alguno = true;
    }
    if (alguno) {
      await landingRepository.marcarGaleriaNotificada(eventoId);
      avisados++;
    }
  }
  return avisados;
}

module.exports = {
  avisarGaleriasHabilitadas,
  listarEventos,
  listarOrganizaciones,
  listarGaleria,
  crearSugerencia,
  marcarMeInteresa,
  quitarMeInteresa,
  sincronizarMeInteresa,
  listarFotosEvento,
  subirFotoEvento,
  eliminarFotoEvento,
};
