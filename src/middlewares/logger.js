const fs   = require('fs');
const path = require('path');

// Crea la carpeta de logs si no existe
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

/**
 * Middleware de logging personalizado.
 * Registra cada request en consola y en archivo logs/app.log
 */
const logger = (req, res, next) => {
  const now       = new Date().toISOString();
  const logEntry  = `[${now}] ${req.method} ${req.originalUrl}\n`;

  // Imprime en consola
  process.stdout.write(logEntry);

  // Escribe en archivo (modo append)
  fs.appendFile(path.join(logsDir, 'app.log'), logEntry, (err) => {
    if (err) console.error('Error escribiendo log:', err.message);
  });

  next();
};

module.exports = { logger };
