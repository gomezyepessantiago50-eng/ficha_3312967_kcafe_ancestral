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

const startServer = () => {
  // Abrimos el puerto de inmediato para que Render (u otra plataforma)
  // detecte el servicio activo sin esperar a la base de datos
  launchServer(PORT);

  // Conectamos la base de datos en paralelo, sin bloquear el arranque
  connectDB().catch((error) => {
    console.error('Error al conectar a la base de datos:', error);
  });
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

    // Iniciar tareas automáticas
    console.log('   [INFO] Tareas automáticas iniciadas (cada 5 min):');
    console.log('          - Limpieza de reservas pendientes no pagadas');
    console.log('          - Auto-completar reservas con fecha de salida pasada');
    setInterval(async () => {
      await reservaService.limpiarReservasPendientes();
      await reservaService.completarReservasVencidas();
    }, 5 * 60 * 1000); // Se ejecuta cada 5 minutos

    // Ejecutar inmediatamente al iniciar el servidor
    reservaService.completarReservasVencidas();
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