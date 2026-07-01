// middlewares/error.middleware.js

const errorHandler = (err, req, res, next) => {
  const status  = err.status  || 500;
  const mensaje = err.message || 'Error interno del servidor';

  console.error(`[ERROR] ${req.method} ${req.url} → ${status}: ${mensaje}`);

  res.status(status).json({
    ok:      false,
    mensaje,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

const notFound = (req, res) => {
  res.status(404).json({
    ok:      false,
    mensaje: `Ruta no encontrada: ${req.method} ${req.url}`,
  });
};

module.exports = { errorHandler, notFound };
