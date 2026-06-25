const knex = require('knex');
const config = require('../../knexfile');

const env = process.env.NODE_ENV || 'development';
const db = knex(config[env]);

async function verificarConexion() {
    try {
        await db.raw('SELECT 1');
        console.log('✅ Conexión a PostgreSQL (Railway) establecida correctamente.');
    } catch (err) {
        console.error('❌ No se pudo conectar a la base de datos:');
        console.error(err.message);
        process.exit(1);
    }
}

module.exports = { db, verificarConexion };