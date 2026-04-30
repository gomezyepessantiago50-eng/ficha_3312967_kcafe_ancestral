/**
 * Middleware global de manejo de errores.
 * Captura cualquier error pasado con next(error) desde controllers/services.
 * Debe registrarse ÚLTIMO en app.js.
 */
const errorHandler = (err, req, res, next) => {
  // Log del error en consola (en producción se puede enviar a un servicio externo)
  console.error(`[ERROR] ${req.method} ${req.originalUrl} →`, err.message || err);

  // Error de validación de Sequelize (campo único duplicado, etc.)
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      success: false,
      message: 'Ya existe un registro con ese valor único.',
      detail:  err.errors?.map((e) => e.message),
    });
  }

  // Error de validación de Sequelize (dato inválido para el tipo de columna)
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Error de validación en los datos enviados.',
      detail:  err.errors?.map((e) => e.message),
    });
  }

  // Error de clave foránea (intenta insertar un ID que no existe)
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return res.status(400).json({
      success: false,
      message: 'El registro referenciado no existe en la base de datos.',
    });
  }

  // Error de base de datos genérico de Sequelize
  if (err.name && err.name.startsWith('Sequelize')) {
    return res.status(500).json({
      success: false,
      message: 'Error interno de base de datos.',
    });
  }

  // Error con código HTTP definido manualmente (ej: throw { status: 403, message: '...' })
  if (err.status) {
    return res.status(err.status).json({
      success: false,
      message: err.message || 'Error en la solicitud.',
    });
  }

  // Error genérico no controlado
  return res.status(500).json({
    success: false,
    message: 'Error interno del servidor.',
  });
};

module.exports = errorHandler;
