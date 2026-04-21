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

    const queryInterface = sequelize.getQueryInterface();
    const foreignKeys = await queryInterface.getForeignKeyReferencesForTable('Reserva').catch(() => []);
    await Promise.all(foreignKeys.map(fk => queryInterface.removeConstraint('Reserva', fk.constraintName).catch(() => null)));

    await sequelize.sync({ alter: true });
    console.log('Modelos sincronizados con la base de datos');
  } catch (error) {
    console.error('Error al conectar a la base de datos:', error.message);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };
