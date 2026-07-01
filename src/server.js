// src/server.js
const app = require('./app');
const { connectDB } = require('./database/connection');
const { exec } = require('child_process');
const reservaService = require('./services/reserva.service');
require('dotenv').config();

const PORT = process.env.PORT || 3000;

const openBrowser = (url) => {
  const command = process.platform === 'win32'
    ? `start "" "${url}"`
    : process.platform === 'darwin'
      ? `open "${url}"`
      : `xdg-open "${url}"`;

  exec(command, (error) => {
    if (error) {
      console.error(`No se pudo abrir el navegador automáticamente: ${error.message}`);
    }
  });
};

const startServer = async () => {
  try {
    await connectDB();
    launchServer(PORT);
  } catch (error) {
    console.error('Error al conectar a la base de datos:', error);
    process.exit(1);
  }
};

const launchServer = (port) => {
  const server = app.listen(port, () => {
    const url = `http://localhost:${port}`;

    console.log('');
    console.log(' ══════════════════════════════════════');
    console.log('   KAFE ANCESTRAL API');
    console.log(`   Puerto: ${port}`);
    console.log(`   Entorno: ${process.env.NODE_ENV || 'development'}`);
    console.log(' ══════════════════════════════════════');
    console.log('');

    // Solo abrir navegador en desarrollo local
    if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'railway') {
      openBrowser(url);
    }

    // Iniciar tarea automática de limpieza de reservas abandonadas
    console.log('   [INFO] Tarea de limpieza automática iniciada (cada 5 min)');
    setInterval(async () => {
      await reservaService.limpiarReservasPendientes();
    }, 5 * 60 * 1000); // Se ejecuta cada 5 minutos
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Error: el puerto ${port} ya está en uso.`);

      if (port === PORT) {
        const fallbackPort = port + 1;
        console.log(`Intentando puerto disponible ${fallbackPort}...`);
        launchServer(fallbackPort);
      } else {
        console.error('No se pudo iniciar el servidor en el puerto alternativo.');
        process.exit(1);
      }
    } else {
      console.error(error);
      process.exit(1);
    }
  });
};

startServer();

