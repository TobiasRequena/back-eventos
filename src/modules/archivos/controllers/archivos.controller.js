const archivosService = require('../services/archivos.service');
const pagosInscripcionService = require('../../pagos/services/pagosInscripcion.service');

/**
 * POST /api/v1/archivos
 * multipart/form-data: el archivo viene en el campo "archivo",
 * más los campos de texto (contexto, eventoId, participanteId) en el resto del form.
 */
async function subir(req, res, next) {
  try {
    if (!req.file) {
      const error = new Error('No se recibió ningún archivo');
      error.status = 400;
      throw error;
    }

    // El contexto se infiere de la ruta, no del body —
    // así evitamos que alguien use el endpoint público para subir portadas.
    const contexto = req.path.includes('comprobante')
      ? 'comprobante_pago'
      : 'portada_evento';

    // El comprobante se liga a una cuota: se resuelve antes de subir para no
    // guardar archivos de cuotas inválidas o ya aprobadas.
    const cuota = contexto === 'comprobante_pago'
      ? await pagosInscripcionService.resolverCuotaParaComprobante(req.body.participanteId, req.body.pagoId)
      : null;

    const resultado = await archivosService.subirArchivo(
      req.file.buffer,
      {
        mimetype: req.file.mimetype,
        originalname: req.file.originalname,
        size: req.file.size,
      },
      {
        contexto,
        orgId: req.body.orgId,
        eventoId: req.body.eventoId,
        participanteId: req.body.participanteId,
        pagoId: cuota?.id,
        usuarioId: req.usuario?.sub,
      }
    );

    if (cuota) {
      await pagosInscripcionService.registrarComprobante(cuota);
    }

    res.status(201).json({ archivo: resultado });
  } catch (error) {
    next(error);
  }
}

async function obtener(req, res, next) {
  try {
    const archivo = await archivosService.obtenerArchivo(req.params.id);
    res.status(200).json({ archivo });
  } catch (error) {
    next(error);
  }
}

async function eliminar(req, res, next) {
  try {
    await archivosService.eliminarArchivo(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

async function subirAutorizacionTemplate(req, res, next) {
  try {
    console.log('[autorizacion-template] body:', req.body);
    console.log('[autorizacion-template] file:', req.file?.originalname);
    if (!req.file) {
      return res.status(400).json({ error: { message: 'No se recibió ningún archivo' } });
    }
    const url = await archivosService.subirAutorizacionTemplate(req.file, req.body.eventoId, req.usuario.sub);
    res.status(200).json({ url });
  } catch (error) { next(error); }
}

module.exports = { subir, obtener, eliminar, subirAutorizacionTemplate };