// server.js
const app         = require('./app');
const { connectDB } = require('./database/connection');
require('dotenv').config();

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  // 1. Conectar a la base de datos
  await connectDB();
  launchServer(PORT);
};

const launchServer = (port) => {
  const server = app.listen(port, () => {
    console.log('');
    console.log(' ══════════════════════════════════════');
    console.log(`   KAFE ANCESTRAL API`);
    console.log(`   Servidor: http://localhost:${port}`);
    console.log(`   Entorno:  ${process.env.NODE_ENV || 'development'}`);
    console.log(' ══════════════════════════════════════');
    console.log('');
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Error: el puerto ${port} ya está en uso.`);
      if (port === PORT) {
        const fallbackPort = port + 1;
        console.log(`Intentando puerto disponible ${fallbackPort}...`);
        launchServer(fallbackPort);
      } else {
        console.error('No se pudo iniciar el servidor en el puerto alternativo. Cierra el proceso que ocupa el puerto o cambia PORT.');
        process.exit(1);
      }
    } else {
      console.error(error);
      process.exit(1);
    }
  });
};

startServer();
