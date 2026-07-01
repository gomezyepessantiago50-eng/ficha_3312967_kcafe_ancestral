// src/controllers/auth.controller.js
'use strict';

const AuthService = require('../services/auth.service');

// ── REGISTRO ─────────────────────────────────────────────────
const registro = async (req, res) => {
  try {
    const result = await AuthService.registro(req.body);
    return res.status(201).json({ ok: true, ...result });
  } catch (error) {
    console.error("Auth Controller Error:", error);
    return res.status(400).json({ ok: false, mensaje: error.message || 'Error desconocido' });
  }
};

// ── SEND OTP ──────────────────────────────────────────────────
const sendOtp = async (req, res) => {
  try {
    const result = await AuthService.sendRegistrationOtp(req.body);
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    return res.status(400).json({ ok: false, mensaje: error.message });
  }
};

// ── LOGIN ─────────────────────────────────────────────────────
const login = async (req, res) => {
  try {
    const result = await AuthService.login(req.body);
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    console.error("Auth Controller Login Error:", error);
    return res.status(400).json({ ok: false, mensaje: error.message || 'Error desconocido' });
  }
};

// ── GOOGLE LOGIN ──────────────────────────────────────────────
const googleLogin = async (req, res) => {
  try {
    const result = await AuthService.googleLogin(req.body);
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    return res.status(400).json({ ok: false, mensaje: error.message });
  }
};

// ── LOGOUT ────────────────────────────────────────────────────
const logout = (req, res) => {
  try {
    // Extraer token del header Authorization
    const token = req.headers.authorization?.split(' ')[1];
    const result = AuthService.logout(token);
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    return res.status(500).json({ ok: false, mensaje: error.message });
  }
};

// ── RECUPERAR CONTRASEÑA ──────────────────────────────────────
const recuperarPassword = async (req, res) => {
  try {
    const result = await AuthService.recuperarPassword(req.body);
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    return res.status(400).json({ ok: false, mensaje: error.message });
  }
};

// ── RESET PASSWORD ────────────────────────────────────────────
const resetPassword = async (req, res) => {
  try {
    const result = await AuthService.resetPassword(req.body);
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    return res.status(400).json({ ok: false, mensaje: error.message });
  }
};

// ── PERFIL ────────────────────────────────────────────────────
const perfil = async (req, res) => {
  try {
    // req.usuario viene del middleware verifyToken
    const result = await AuthService.perfil(req.usuario.id);
    return res.status(200).json({ ok: true, usuario: result });
  } catch (error) {
    return res.status(404).json({ ok: false, mensaje: error.message });
  }
};

// ── ACTUALIZAR PERFIL ─────────────────────────────────────────
const actualizarPerfil = async (req, res) => {
  try {
    const result = await AuthService.actualizarPerfil(req.usuario.id, req.body);
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    return res.status(400).json({ ok: false, mensaje: error.message });
  }
};

// ── DESACTIVAR CUENTA CLIENTE ─────────────────────────────────
const desactivarCuentaCliente = async (req, res) => {
  try {
    const result = await AuthService.desactivarCuentaCliente(req.usuario.id);
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    return res.status(400).json({ ok: false, mensaje: error.message });
  }
};

// ── ELIMINAR CUENTA CLIENTE ───────────────────────────────────
const eliminarCuentaCliente = async (req, res) => {
  try {
    const result = await AuthService.eliminarCuentaCliente(req.usuario.id);
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    return res.status(400).json({ ok: false, mensaje: error.message });
  }
};

module.exports = { registro, sendOtp, login, googleLogin, logout, recuperarPassword, resetPassword, perfil, actualizarPerfil, desactivarCuentaCliente, eliminarCuentaCliente };
