const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const errorHandler = require('./middlewares/errorHandler');

const {
    routerBloquesAnidado,
    routerTalleresEnBloque,
    routerBloquesPlano,
    routerTalleresPlano,
} = require('./modules/talleres/routes/talleres.routes');
const routerOrganizaciones = require('./modules/organizaciones/routes/organizaciones.routes');
const routerEventos = require('./modules/eventos/routes/eventos.routes');
const routerAuth = require('./modules/auth/routes/auth.routes');
const routerArchivos = require('./modules/archivos/routes/archivos.routes');
const {
    routerAnidado: participantesAnidado,
    routerPublico: participantesPublico,
    routerPlano: participantesPlano,
    routerMixto: participantesMixto,
} = require('./modules/participantes/routes/participantes.routes');
const {
    routerPublico: gruposPublico,
    routerAnidado: gruposAnidado,
    routerPlano: gruposPlano,
    routerPanel: gruposPanel,
} = require('./modules/grupos/routes/grupos.routes');
const routerFormularios = require('./modules/formularios/routes/formularios.routes');

const app = express();

// Middlewares globales
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Healthcheck — útil para verificar que el server y Railway responden
app.get('/api/v1/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Acá van montándose las rutas de cada módulo a medida que las construyamos:
// Auth
app.use('/api/v1/auth', routerAuth);

// Organizaciones
app.use('/api/v1/organizaciones', routerOrganizaciones);

// Eventos: CRUD + stats + búsqueda por código
app.use('/api/v1/eventos', routerEventos);

// Talleres: bloques anidados en evento, talleres en bloque, CRUD plano
app.use('/api/v1/eventos', routerBloquesAnidado);
app.use('/api/v1/bloques-taller', routerTalleresEnBloque);
app.use('/api/v1/bloques-taller', routerBloquesPlano);
app.use('/api/v1/talleres', routerTalleresPlano);

// Archivos
app.use('/api/v1/archivos', routerArchivos);

// Participantes
app.use('/api/v1/participantes', participantesPublico);
app.use('/api/v1/participantes', participantesMixto);  // ← antes que plano
app.use('/api/v1/eventos', participantesAnidado);
app.use('/api/v1/participantes', participantesPlano);

// Grupos
app.use('/api/v1/grupos', gruposPublico);
app.use('/api/v1/grupos', gruposPanel);  // ← panel ANTES que plano
app.use('/api/v1/eventos', gruposAnidado);
app.use('/api/v1/grupos', gruposPlano);  // ← plano al final

// Formularios
app.use('/api/v1/eventos', routerFormularios);

// 404 para rutas no encontradas
app.use((req, res) => {
    res.status(404).json({ error: { message: 'Recurso no encontrado' } });
});

// Manejo de errores (siempre al final)
app.use(errorHandler);

module.exports = app;