const adminRepository = require('../repositories/admin.repository');

function rellenarDias(porDia, desde, hasta) {
  const mapa = {};
  for (const fila of porDia) {
    const fecha = new Date(fila.fecha).toISOString().split('T')[0];
    mapa[fecha] = Number(fila.cantidad ?? fila.total ?? 0);
  }

  const resultado = [];
  const cursor = new Date(desde);
  const fin = new Date(hasta);

  while (cursor <= fin) {
    const fecha = cursor.toISOString().split('T')[0];
    resultado.push({ fecha, valor: mapa[fecha] ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  return resultado;
}
function calcularVariacion(actual, anterior) {
  if (anterior === 0) return actual > 0 ? 100 : 0;
  return Math.round(((actual - anterior) / anterior) * 100 * 100) / 100;
}

async function obtenerStats(desde, hasta) {
  // Calcular período anterior (mismo rango pero 1 mes atrás)
  const desdeAnterior = new Date(desde);
  desdeAnterior.setMonth(desdeAnterior.getMonth() - 1);

  const hastaAnterior = new Date(hasta);
  hastaAnterior.setMonth(hastaAnterior.getMonth() - 1);

  const [
    usuarios,
    organizaciones,
    eventos,
    inscriptos,
    revenue,
    usuariosAnt,
    organizacionesAnt,
    inscriptosAnt,
    revenueAnt,
    eventosAnt,
  ] = await Promise.all([
    adminRepository.statsUsuarios(desde, hasta),
    adminRepository.statsOrganizaciones(desde, hasta),
    adminRepository.statsEventos(desde, hasta),
    adminRepository.statsInscriptos(desde, hasta),
    adminRepository.statsRevenue(desde, hasta),
    adminRepository.statsUsuarios(desdeAnterior, hastaAnterior),
    adminRepository.statsOrganizaciones(desdeAnterior, hastaAnterior),
    adminRepository.statsInscriptos(desdeAnterior, hastaAnterior),
    adminRepository.statsRevenue(desdeAnterior, hastaAnterior),
    adminRepository.statsEventos(desdeAnterior, hastaAnterior),
  ]);

  return {
    usuarios: {
      total: usuarios.total,
      nuevos: usuarios.nuevos,
      variacion: calcularVariacion(usuarios.total, usuariosAnt.total),
      evolucion: rellenarDias(usuarios.porDia, desde, hasta),
    },
    organizaciones: {
      total: organizaciones.total,
      nuevos: organizaciones.nuevos,
      variacion: calcularVariacion(
        organizaciones.total,
        organizacionesAnt.total
      ),
      evolucion: rellenarDias(organizaciones.porDia, desde, hasta),
    },
    eventos: {
      activos: eventos.activos,
      finalizados: eventos.finalizados,
      nuevos: eventos.nuevos,
      variacion: calcularVariacion(eventos.nuevos, eventosAnt.nuevos),
      evolucion: rellenarDias(eventos.porDia, desde, hasta),
    },
    inscriptos: {
      total: inscriptos.total,
      variacion: calcularVariacion(inscriptos.total, inscriptosAnt.total),
      evolucion: rellenarDias(inscriptos.porDia, desde, hasta),
    },
    revenue: {
      total: revenue.total,
      variacion: calcularVariacion(revenue.total, revenueAnt.total),
      evolucion: rellenarDias(revenue.porDia, desde, hasta),
    },
  };
}

module.exports = { obtenerStats };