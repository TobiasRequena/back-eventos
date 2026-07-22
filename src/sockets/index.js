const { Server } = require('socket.io');
const { setIO } = require('./emitter');

function initSockets(httpServer) {
    const io = new Server(httpServer, {
        cors: {
            origin: process.env.FRONTEND_URL || 'http://localhost:5173',
            methods: ['GET', 'POST'],
            credentials: true,
        },
    });

    io.on('connection', (socket) => {
        console.log(`[socket] cliente conectado: ${socket.id}`);

        // El cliente debe emitir esto al conectarse, indicando a qué evento quiere "escuchar"
        socket.on('unirse_evento', (eventoId) => {
            socket.join(`evento:${eventoId}`);
            console.log(`[socket] ${socket.id} se unió a evento:${eventoId}`);
        });

        socket.on('salir_evento', (eventoId) => {
            socket.leave(`evento:${eventoId}`);
        });

        socket.on('disconnect', () => {
            console.log(`[socket] cliente desconectado: ${socket.id}`);
        });
    });

    setIO(io);
    return io;
}

module.exports = { initSockets };