// src/services/auth.service.js
'use strict';

const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const Usuario = require('../models/usuario.model');
const { Op }  = require('sequelize');

// ── Blacklist en memoria (en producción usar Redis) ──────────
const tokenBlacklist = new Set();

// ── Helpers ──────────────────────────────────────────────────
const signToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });

const buildUserPayload = (usuario) => ({
  id:     usuario.IDUsuario,
  IDUsuario: usuario.IDUsuario,
  email:  usuario.Email,
  nombre: usuario.NombreUsuario,
  rol:    usuario.IDRol === 1 ? 'admin' : 'cliente',
  idRol:  usuario.IDRol,
  IDRol:  usuario.IDRol,
});

// ── REGISTRO ─────────────────────────────────────────────────
const registro = async ({ nombre, apellido, email, password, telefono, tipoDocumento, numeroDocumento, pais, direccion, idRol }) => {
  // Verificar si el email ya existe
  const existe = await Usuario.findOne({ where: { Email: email } });
  if (existe) throw new Error('El correo electrónico ya está registrado.');

  // Hashear contraseña
  const hash = await bcrypt.hash(password, 12);

  // Crear usuario (rol por defecto: 2 = Cliente)
  const usuario = await Usuario.create({
    NombreUsuario:   nombre,
    Apellido:        apellido    || null,
    Email:           email,
    Contrasena:      hash,
    Telefono:        telefono    || null,
    TipoDocumento:   tipoDocumento || null,
    NumeroDocumento: numeroDocumento || null,
    Pais:            pais        || null,
    Direccion:       direccion   || null,
    IDRol:           idRol       || 2,
  });

  const token = signToken(buildUserPayload(usuario));

  return {
    token,
    usuario: {
      id:     usuario.IDUsuario,
      nombre: usuario.NombreUsuario,
      email:  usuario.Email,
      rol:    usuario.IDRol === 1 ? 'admin' : 'cliente',
    },
  };
};

// ── LOGIN ─────────────────────────────────────────────────────
const login = async ({ email, password }) => {
  // Buscar usuario
  const usuario = await Usuario.findOne({ where: { Email: email } });
  if (!usuario) throw new Error('Credenciales incorrectas.');

  // Verificar contraseña
  const valida = await bcrypt.compare(password, usuario.Contrasena);
  if (!valida) throw new Error('Credenciales incorrectas.');

  const token = signToken(buildUserPayload(usuario));

  return {
    token,
    usuario: {
      id:     usuario.IDUsuario,
      nombre: usuario.NombreUsuario,
      apellido: usuario.Apellido,
      email:  usuario.Email,
      rol:    usuario.IDRol === 1 ? 'admin' : 'cliente',
      idRol:  usuario.IDRol,
    },
  };
};

// ── LOGOUT ────────────────────────────────────────────────────
const logout = (token) => {
  if (token) tokenBlacklist.add(token);
  return { mensaje: 'Sesión cerrada correctamente.' };
};

const isTokenRevocado = (token) => tokenBlacklist.has(token);

// ── RECUPERAR CONTRASEÑA ──────────────────────────────────────
const recuperarPassword = async ({ email }) => {
  const usuario = await Usuario.findOne({ where: { Email: email } });

  // Siempre responder igual para no revelar si el email existe
  if (!usuario) {
    return { mensaje: 'Si el correo existe, recibirás las instrucciones.' };
  }

  // Generar token único
  const resetToken  = crypto.randomBytes(32).toString('hex');
  const tokenHashed = crypto.createHash('sha256').update(resetToken).digest('hex');
  const expira      = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

  await usuario.update({
    ResetToken:       tokenHashed,
    ResetTokenExpira: expira,
  });

  // En producción: enviar email con el token
  // Por ahora lo devolvemos en la respuesta (solo para desarrollo)
  console.log(`\n🔑 Token de recuperación para ${email}: ${resetToken}\n`);

  return {
    mensaje:     'Si el correo existe, recibirás las instrucciones.',
    // Solo en desarrollo — eliminar en producción:
    devToken:    process.env.NODE_ENV === 'development' ? resetToken : undefined,
  };
};

// ── RESET PASSWORD ────────────────────────────────────────────
const resetPassword = async ({ token, nuevaPassword }) => {
  // Hashear el token recibido para comparar con el almacenado
  const tokenHashed = crypto.createHash('sha256').update(token).digest('hex');

  const usuario = await Usuario.findOne({
    where: {
      ResetToken:       tokenHashed,
      ResetTokenExpira: { [Op.gt]: new Date() },
    },
  });

  if (!usuario) throw new Error('Token inválido o expirado.');

  const hash = await bcrypt.hash(nuevaPassword, 12);

  await usuario.update({
    Contrasena:       hash,
    ResetToken:       null,
    ResetTokenExpira: null,
  });

  return { mensaje: 'Contraseña actualizada correctamente.' };
};

// ── PERFIL ────────────────────────────────────────────────────
const perfil = async (idUsuario) => {
  const usuario = await Usuario.findByPk(idUsuario, {
    attributes: { exclude: ['Contrasena', 'ResetToken', 'ResetTokenExpira'] },
  });

  if (!usuario) throw new Error('Usuario no encontrado.');

  return {
    id:              usuario.IDUsuario,
    nombre:          usuario.NombreUsuario,
    apellido:        usuario.Apellido,
    email:           usuario.Email,
    telefono:        usuario.Telefono,
    tipoDocumento:   usuario.TipoDocumento,
    numeroDocumento: usuario.NumeroDocumento,
    pais:            usuario.Pais,
    direccion:       usuario.Direccion,
    rol:             usuario.IDRol === 1 ? 'admin' : 'cliente',
    idRol:           usuario.IDRol,
  };
};

module.exports = {
  registro,
  login,
  logout,
  isTokenRevocado,
  recuperarPassword,
  resetPassword,
  perfil,
};
