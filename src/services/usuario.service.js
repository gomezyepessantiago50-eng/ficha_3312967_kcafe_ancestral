// src/services/usuario.service.js
'use strict';

const bcrypt  = require('bcryptjs');
const crypto  = require('crypto');
const Usuario = require('../models/usuario.model');
const { Op }  = require('sequelize');

// ── Buscar usuario por email ──────────────────────────────────
const buscarPorEmail = async (email) => {
  const usuario = await Usuario.findOne({
    where: { Email: { [Op.like]: `%${email}%` } },
    attributes: { exclude: ['Contrasena', 'ResetToken', 'ResetTokenExpira'] },
  });
  if (!usuario) throw Object.assign(new Error('No se encontró ningún usuario con ese correo.'), { status: 404 });

  return normalizeUsuario(usuario);
};

// ── Cambiar rol ───────────────────────────────────────────────
const cambiarRol = async (id, nuevoRol) => {
  const rolId = nuevoRol === 'admin' ? 1 : 2;
  const usuario = await Usuario.findByPk(id);
  if (!usuario) throw Object.assign(new Error('Usuario no encontrado.'), { status: 404 });

  await usuario.update({ IDRol: rolId });

  return {
    mensaje: `Rol actualizado a ${nuevoRol} correctamente.`,
    usuario: normalizeUsuario(usuario),
  };
};

// ── Eliminar cuenta ───────────────────────────────────────────
const eliminarCuenta = async (id, adminId) => {
  if (parseInt(id) === parseInt(adminId)) {
    throw Object.assign(new Error('No puedes eliminar tu propia cuenta.'), { status: 400 });
  }
  const usuario = await Usuario.findByPk(id);
  if (!usuario) throw Object.assign(new Error('Usuario no encontrado.'), { status: 404 });

  await usuario.destroy();
  return { mensaje: 'Cuenta eliminada correctamente.' };
};

// ── Restablecer contraseña (admin genera token) ───────────────
const generarResetAdmin = async (id) => {
  const usuario = await Usuario.findByPk(id);
  if (!usuario) throw Object.assign(new Error('Usuario no encontrado.'), { status: 404 });

  const resetToken  = crypto.randomBytes(32).toString('hex');
  const tokenHashed = crypto.createHash('sha256').update(resetToken).digest('hex');
  const expira      = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

  await usuario.update({ ResetToken: tokenHashed, ResetTokenExpira: expira });

  return {
    mensaje: `Token de restablecimiento generado para ${usuario.Email}.`,
    email:   usuario.Email,
    // En producción esto se enviaría por email — lo devolvemos para el admin
    resetToken,
    resetUrl: `/index.html?token=${resetToken}`,
  };
};

// ── Listar todos los usuarios (paginado, con búsqueda) ───────
const listarUsuarios = async ({ page = 1, limit = 10, q = '' } = {}) => {
  const offset = (page - 1) * limit;

  const where = {};
  if (q) {
    where[Op.or] = [
      { NombreUsuario:   { [Op.like]: `%${q}%` } },
      { Apellido:        { [Op.like]: `%${q}%` } },
      { Email:           { [Op.like]: `%${q}%` } },
      { NumeroDocumento: { [Op.like]: `%${q}%` } },
    ];
  }

  const { count, rows } = await Usuario.findAndCountAll({
    where,
    attributes: { exclude: ['Contrasena', 'ResetToken', 'ResetTokenExpira'] },
    order: [['IDRol', 'ASC'], ['NombreUsuario', 'ASC']],
    limit,
    offset,
  });

  const todos = rows.map(normalizeUsuario);
  const admins   = todos.filter(u => u.idRol === 1);
  const clientes = todos.filter(u => u.idRol !== 1);

  return {
    data:        todos,
    admins,
    clientes,
    total:       count,
    totalPages:  Math.ceil(count / limit),
    currentPage: page,
  };
};

// ── Helper normalizar ─────────────────────────────────────────
const normalizeUsuario = (u) => ({
  id:              u.IDUsuario,
  nombre:          u.NombreUsuario,
  apellido:        u.Apellido,
  email:           u.Email,
  telefono:        u.Telefono,
  tipoDocumento:   u.TipoDocumento,
  numeroDocumento: u.NumeroDocumento,
  pais:            u.Pais,
  direccion:       u.Direccion,
  rol:             u.IDRol === 1 ? 'admin' : 'cliente',
  idRol:           u.IDRol,
});

module.exports = { buscarPorEmail, cambiarRol, eliminarCuenta, generarResetAdmin, listarUsuarios };
