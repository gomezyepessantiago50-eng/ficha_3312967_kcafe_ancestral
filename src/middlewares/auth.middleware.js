// src/middlewares/auth.middleware.js
'use strict';

const jwt = require('jsonwebtoken');
require('dotenv').config();

// Importación con fallback por si auth.service aún no existe
let isTokenRevocado = () => false;
try {
  isTokenRevocado = require('../services/auth.service').isTokenRevocado;
} catch (_) {}

// ── Verificar token JWT ───────────────────────────────────────
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      ok:      false,
      mensaje: 'Acceso denegado. Token no proporcionado.',
    });
  }

  // Token demo para pruebas rápidas (eliminar en producción)
  if (token === 'token-admin-demo') {
    req.user    = { IDUsuario: 1, IDRol: 1, NombreUsuario: 'Admin Demo' };
    req.usuario = { id: 1, rol: 'admin', nombre: 'Admin Demo' };
    return next();
  }
  if (token === 'token-cliente-demo') {
    req.user    = { IDUsuario: 2, IDRol: 2, NombreUsuario: 'Cliente Demo' };
    req.usuario = { id: 2, rol: 'cliente', nombre: 'Cliente Demo' };
    return next();
  }

  // Verificar si fue revocado por logout
  if (isTokenRevocado(token)) {
    return res.status(401).json({
      ok:      false,
      mensaje: 'Token inválido. Por favor inicia sesión nuevamente.',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Compatibilidad con ambos formatos
    req.user    = {
      ...decoded,
      IDUsuario: decoded.id || decoded.IDUsuario,  // Asegurar que esté IDUsuario
      IDRol: decoded.idRol || decoded.IDRol,
    };
    req.usuario = {                       // módulo auth (rol, id)
      id:     decoded.id     || decoded.IDUsuario,
      rol:    decoded.rol    || (decoded.IDRol === 1 ? 'admin' : 'cliente'),
      nombre: decoded.nombre || decoded.NombreUsuario,
      email:  decoded.email,
      idRol:  decoded.idRol  || decoded.IDRol,
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        ok:      false,
        mensaje: 'Tu sesión ha expirado. Por favor inicia sesión nuevamente.',
      });
    }
    return res.status(401).json({
      ok:      false,
      mensaje: 'Token inválido.',
    });
  }
};

// ── Solo Administrador ────────────────────────────────────────
const soloAdmin = (req, res, next) => {
  if (req.user?.IDRol !== 1 && req.usuario?.rol !== 'admin') {
    return res.status(403).json({
      ok:      false,
      mensaje: 'Acceso denegado. Se requiere rol Administrador.',
    });
  }
  next();
};

// Alias para el módulo auth
const esAdmin   = soloAdmin;

// ── Solo Cliente ──────────────────────────────────────────────
const esCliente = (req, res, next) => {
  if (req.usuario?.rol !== 'cliente') {
    return res.status(403).json({
      ok:      false,
      mensaje: 'Acceso denegado. Solo clientes pueden realizar esta acción.',
    });
  }
  next();
};

// ── Propietario del recurso ───────────────────────────────────
const esPropietario = (req, res, next) => {
  const idParam = parseInt(req.params.id);
  const idUsuario = req.usuario?.id || req.user?.IDUsuario;
  const rol = req.usuario?.rol || (req.user?.IDRol === 1 ? 'admin' : 'cliente');
  if (idUsuario !== idParam && rol !== 'admin') {
    return res.status(403).json({
      ok:      false,
      mensaje: 'No tienes permiso para acceder a este recurso.',
    });
  }
  next();
};

module.exports = { verifyToken, soloAdmin, esAdmin, esCliente, esPropietario };
