// middlewares/auth.middleware.js
const jwt = require('jsonwebtoken');
require('dotenv').config();

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({
      ok: false,
      mensaje: 'Acceso denegado. Token no proporcionado',
    });
  }

  // Para demo, aceptar token-demo
  if (token === 'token-demo') {
    req.user = { IDUsuario: 1, IDRol: 2, NombreUsuario: 'Demo User' }; // Cliente por defecto
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { IDUsuario, IDRol, NombreUsuario, ... }
    next();
  } catch (error) {
    return res.status(401).json({
      ok: false,
      mensaje: 'Token inválido o expirado',
    });
  }
};

// Solo permite acceso al rol Administrador (IDRol = 1)
const soloAdmin = (req, res, next) => {
  if (req.user?.IDRol !== 1) {
    return res.status(403).json({
      ok: false,
      mensaje: 'Acceso denegado. Se requiere rol Administrador',
    });
  }
  next();
};

module.exports = { verifyToken, soloAdmin };
