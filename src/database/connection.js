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
  }
);

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('Conexion a MySQL establecida correctamente');

    // Sincronizar modelos sin alterar tablas existentes
    await sequelize.sync({ force: false });
    console.log('Modelos sincronizados con la base de datos');
  } catch (error) {
    console.error('Error al conectar a la base de datos:', error.message);
    // No hacer exit(1) para permitir que el servidor continue
    console.warn('⚠️  Continuando sin sincronización automática...');
  }
};

module.exports = { sequelize, connectDB };
