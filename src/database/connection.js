const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: false,
    dialectOptions: {
      connectTimeout: 10000, // máximo 10 segundos para conectar
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 10000,
      idle: 10000,
    },
  }
);

// ── Bandera de disponibilidad de la BD ───────────────────────
let _dbReady = false;
const isDbReady = () => _dbReady;

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('Conexion a MySQL establecida correctamente');

    // Cargar todos los modelos ANTES de sincronizar
    require('../models');

    // Sincronizar con reintentos para evitar errores de constraints
    let synced = false;
    for (let attempt = 1; attempt <= 3 && !synced; attempt++) {
      try {
        await sequelize.sync({ alter: true });
        synced = true;
      } catch (syncErr) {
        console.warn(`[DB Sync] Intento ${attempt}/3 falló: ${syncErr.message}`);
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 2000)); // esperar 2s antes de reintentar
        }
      }
    }

    if (!synced) {
      // Último recurso: sync sin alter (solo crea tablas faltantes, no modifica)
      try {
        await sequelize.sync({ force: false });
        synced = true;
        console.warn('[DB Sync] Sincronización básica exitosa (sin alter).');
      } catch (fallbackErr) {
        console.error('[DB Sync] Error crítico en sincronización:', fallbackErr.message);
      }
    }

    if (synced) {
      console.log('Modelos sincronizados con la base de datos');
    }

    // ═══ Marcar DB como lista DESPUÉS de que sync termine ═══
    _dbReady = true;
    console.log('[DB] ✅ Base de datos lista para recibir peticiones.');
  } catch (error) {
    console.error('Error al conectar a la base de datos:', error.message);
  }
};

module.exports = { sequelize, connectDB, isDbReady };