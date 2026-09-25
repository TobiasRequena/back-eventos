require('dotenv').config();

const http = require('http');
const app = require('./src/app');
const { initSockets } = require('./src/sockets');
const { verificarConexion } = require('./src/config/db');
const { purgarEliminados } = require('./src/modules/participantes/repositories/participantes.repository');
const { avisarGaleriasHabilitadas } = require('./src/modules/landing/controllers/landing.controller');

// Purga automática de participantes eliminados hace más de 90 días
// Corre una vez al día al levantar el servidor y cada 24hs después
async function programarPurga() {
    const INTERVALO = 24 * 60 * 60 * 1000; // 24 horas en ms

    async function purgar() {
        try {
            const cantidad = await purgarEliminados();
            if (cantidad > 0) {
                console.log(`[purga] ${cantidad} participantes eliminados físicamente`);
            }
        } catch (err) {
            console.error('[purga] Error al purgar participantes:', err.message);
        }
    }

    await purgar(); // primera vez al levantar
    setInterval(purgar, INTERVALO);
}

// Mail "ya podés subir las fotos" a los eventos que terminaron
// ponytail: revisa cada 1 hora, así que el mail llega hasta 1 h después del fin; bajar el intervalo si hace falta
async function programarAvisoGaleria() {
    const INTERVALO = 60 * 60 * 1000; // 1 hora en ms

    async function avisar() {
        try {
            const cantidad = await avisarGaleriasHabilitadas();
            if (cantidad > 0) {
                console.log(`[galeria] Aviso enviado para ${cantidad} evento(s) finalizado(s)`);
            }
        } catch (err) {
            console.error('[galeria] Error al avisar galerías habilitadas:', err.message);
        }
    }

    await avisar();
    setInterval(avisar, INTERVALO);
}

const PORT = process.env.PORT || 3001;

async function iniciar() {
    await verificarConexion();
    programarPurga(); // sin await — corre en background
    programarAvisoGaleria();

    const httpServer = http.createServer(app);
    initSockets(httpServer);

    httpServer.listen(PORT, () => {
        console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    });
}

iniciar();