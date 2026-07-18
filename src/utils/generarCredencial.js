const { createCanvas, loadImage } = require('canvas');
const QRCode = require('qrcode');

/**
 * Genera una imagen de credencial con el QR, nombre del evento,
 * nombre del participante y DNI.
 * Devuelve un Buffer de la imagen PNG — listo para adjuntar al mail.
 */
async function generarCredencial({ qrPersonal, nombreEvento, nombreParticipante, dni }) {
  const WIDTH = 400;
  const HEIGHT = 520;
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  // Fondo blanco
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Franja superior azul
  ctx.fillStyle = '#2563EB';
  ctx.fillRect(0, 0, WIDTH, 70);

  // Título del evento en la franja
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 18px Arial';
  ctx.textAlign = 'center';

  // Si el nombre es largo, achicamos la fuente
  const nombreEventoCorto = nombreEvento.length > 30
    ? nombreEvento.slice(0, 30) + '...'
    : nombreEvento;
  ctx.fillText(nombreEventoCorto, WIDTH / 2, 30);

  ctx.font = '13px Arial';
  ctx.fillText('Credencial de acceso', WIDTH / 2, 52);

  // Generar QR como imagen y dibujarlo en el canvas
  const qrDataUrl = await QRCode.toDataURL(qrPersonal, {
    width: 260,
    margin: 1,
    color: { dark: '#1E3A5F', light: '#FFFFFF' },
  });
  const qrImage = await loadImage(qrDataUrl);
  ctx.drawImage(qrImage, (WIDTH - 260) / 2, 90, 260, 260);

  // Separador
  ctx.strokeStyle = '#E5E7EB';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, 370);
  ctx.lineTo(360, 370);
  ctx.stroke();

  // Nombre del participante
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 20px Arial';
  ctx.textAlign = 'center';
  const nombreCompleto = nombreParticipante.length > 28
    ? nombreParticipante.slice(0, 28) + '...'
    : nombreParticipante;
  ctx.fillText(nombreCompleto, WIDTH / 2, 410);

  // DNI
  ctx.fillStyle = '#6B7280';
  ctx.font = '14px Arial';
  ctx.fillText(`DNI: ${dni}`, WIDTH / 2, 440);

  // Texto inferior
  ctx.fillStyle = '#9CA3AF';
  ctx.font = '11px Arial';
  ctx.fillText('Presentá esta credencial el día del evento', WIDTH / 2, 490);

  return canvas.toBuffer('image/png');
}

module.exports = { generarCredencial };