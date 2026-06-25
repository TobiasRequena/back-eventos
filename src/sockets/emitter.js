let io;

function setIO(socketIOInstance) {
    io = socketIOInstance;
}

function emitirAEvento(eventoId, nombreEvento, payload) {
    if (!io) return;
    io.to(`evento:${eventoId}`).emit(nombreEvento, payload);
}

module.exports = { setIO, emitirAEvento };