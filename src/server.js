require('dotenv').config();
const app        = require('./app');
const sequelize  = require('./database/connection');

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    // Verifica la conexión con la base de datos antes de levantar el servidor
    await sequelize.authenticate();
    console.log('✅ Conexión a la base de datos establecida correctamente.');

    // Sincroniza modelos sin alterar tablas existentes
    await sequelize.sync({ alter: false });
    console.log('✅ Modelos sincronizados.');

    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Error al iniciar el servidor:', error);
    process.exit(1);
  }
};

startServer();
