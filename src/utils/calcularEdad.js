function calcularEdad(nacimiento) {
  if (!nacimiento) return null;

  const hoy = new Date();
  const nac = new Date(nacimiento);

  // nac viene serializada en UTC medianoche (columna DATE de Postgres o
  // string ISO "YYYY-MM-DD"): hay que leerla con getters UTC, si no el
  // día se corre en servidores con TZ detrás de UTC (ej. Argentina).
  let edad = hoy.getFullYear() - nac.getUTCFullYear();

  if (
    hoy < new Date(
      hoy.getFullYear(),
      nac.getUTCMonth(),
      nac.getUTCDate()
    )
  ) {
    edad--;
  }

  return edad;
}

module.exports = calcularEdad;