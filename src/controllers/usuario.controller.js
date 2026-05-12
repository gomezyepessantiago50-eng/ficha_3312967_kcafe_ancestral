// src/controllers/usuario.controller.js
'use strict';

const UsuarioService = require('../services/usuario.service');

// ── Buscar por email ──────────────────────────────────────────
const buscarPorEmail = async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ ok: false, mensaje: 'El correo es requerido.' });
    const usuario = await UsuarioService.buscarPorEmail(email);
    return res.status(200).json({ ok: true, usuario });
  } catch (error) {
    return res.status(error.status || 500).json({ ok: false, mensaje: error.message });
  }
};

// ── Listar todos con paginación ───────────────────────────────
const listarUsuarios = async (req, res) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 10;
    const q     = req.query.q || '';

    const result = await UsuarioService.listarUsuarios({ page, limit, q });
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    return res.status(error.status || 500).json({ ok: false, mensaje: error.message });
  }
};

// ── Cambiar rol ───────────────────────────────────────────────
const cambiarRol = async (req, res) => {
  try {
    const { id }  = req.params;
    const { rol } = req.body;
    if (!rol || !['admin', 'cliente'].includes(rol)) {
      return res.status(400).json({ ok: false, mensaje: 'Rol inválido. Usa "admin" o "cliente".' });
    }
    const result = await UsuarioService.cambiarRol(id, rol);
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    return res.status(error.status || 500).json({ ok: false, mensaje: error.message });
  }
};

// ── Eliminar cuenta ───────────────────────────────────────────
const eliminarCuenta = async (req, res) => {
  try {
    const adminId = req.usuario?.id || req.user?.IDUsuario;
    const result  = await UsuarioService.eliminarCuenta(req.params.id, adminId);
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    return res.status(error.status || 500).json({ ok: false, mensaje: error.message });
  }
};

// ── Generar reset de contraseña (admin) ───────────────────────
const generarReset = async (req, res) => {
  try {
    const result = await UsuarioService.generarResetAdmin(req.params.id);
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    return res.status(error.status || 500).json({ ok: false, mensaje: error.message });
  }
};

module.exports = { buscarPorEmail, listarUsuarios, cambiarRol, eliminarCuenta, generarReset };
