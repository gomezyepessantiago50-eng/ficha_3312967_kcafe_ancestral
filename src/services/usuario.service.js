// src/services/usuario.service.js
'use strict';

const bcrypt  = require('bcryptjs');
const crypto  = require('crypto');
const Usuario = require('../models/usuario.model');
const { Op }  = require('sequelize');
const emailService = require('./email.service');
const Reserva = require('../models/reserva.model');

// ── Buscar usuario por email ──────────────────────────────────
const buscarPorEmail = async (email) => {
  const usuario = await Usuario.findOne({
    where: { Email: { [Op.like]: `%${email}%` } },
    attributes: { exclude: ['Contrasena', 'ResetToken', 'ResetTokenExpira'] },
  });
  if (!usuario) throw Object.assign(new Error('No se encontró ningún usuario con ese correo.'), { status: 404 });

  return normalizeUsuario(usuario);
};

// ── Crear usuario ─────────────────────────────────────────────
const crearUsuario = async ({ nombre, apellido, email, password, telefono, tipoDocumento, numeroDocumento, pais, direccion, rol, estado }) => {
  if (!email) throw Object.assign(new Error('El correo es requerido.'), { status: 400 });

  const existeEmail = await Usuario.findOne({ where: { Email: email } });
  if (existeEmail) throw Object.assign(new Error('El correo electrónico ya está registrado.'), { status: 400 });

  if (numeroDocumento) {
    const existeDoc = await Usuario.findOne({ where: { NumeroDocumento: numeroDocumento } });
    if (existeDoc) throw Object.assign(new Error('El número de documento ya está registrado con otra cuenta.'), { status: 400 });
  }

  if (telefono) {
    const existeTel = await Usuario.findOne({ where: { Telefono: telefono } });
    if (existeTel) throw Object.assign(new Error('El teléfono ya está registrado con otra cuenta.'), { status: 400 });
  }

  // Generar contraseña aleatoria segura — el admin nunca la conoce
  const randomPassword = password || (crypto.randomBytes(20).toString('hex') + 'A!1a');
  const hash = await bcrypt.hash(randomPassword, 12);
  const idRol = rol === 'admin' ? 1 : 2;

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
    IDRol:           idRol,
    Estado:          estado !== false, // default true
  });

  // Si no se proporcionó contraseña (creación desde admin), generar token
  // de restablecimiento válido por 10 minutos y enviar correo de invitación
  if (!password) {
    const resetToken  = crypto.randomBytes(32).toString('hex');
    const tokenHashed = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expira      = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

    await usuario.update({ ResetToken: tokenHashed, ResetTokenExpira: expira });

    // Enviar email de invitación con enlace para establecer contraseña
    emailService.enviarInvitacionCuenta({
      to: email,
      nombre: nombre,
      token: resetToken,
    }).catch(err => console.error('Error enviando email de invitación:', err.message));
  }

  return {
    mensaje: !password
      ? 'Cuenta creada. Se envió un correo al cliente para que establezca su contraseña (válido por 10 minutos).'
      : 'Usuario creado correctamente.',
    usuario: normalizeUsuario(usuario),
  };
};

// ── Cambiar rol ───────────────────────────────────────────────
const cambiarRol = async (id, nuevoRol) => {
  const usuario = await Usuario.findByPk(id);
  if (!usuario) throw Object.assign(new Error('Usuario no encontrado.'), { status: 404 });
  if (usuario.Email === 'admin@kafeancestral.com' || usuario.Email === 'infokcafeancestral@gmail.com') {
    throw Object.assign(new Error('No se puede modificar el rol de este administrador protegido.'), { status: 403 });
  }
  const rolId = nuevoRol === 'admin' ? 1 : 2;

  await usuario.update({ IDRol: rolId });

  return {
    mensaje: `Rol actualizado a ${nuevoRol} correctamente.`,
    usuario: normalizeUsuario(usuario),
  };
};

// ── Cambiar estado ────────────────────────────────────────────
const cambiarEstado = async (id, estado) => {
  const usuario = await Usuario.findByPk(id);
  if (!usuario) throw Object.assign(new Error('Usuario no encontrado.'), { status: 404 });
  if (usuario.Email === 'admin@kafeancestral.com' || usuario.Email === 'infokcafeancestral@gmail.com') {
    throw Object.assign(new Error('No se puede cambiar el estado de este administrador protegido.'), { status: 403 });
  }

  await usuario.update({ Estado: estado });

  return {
    mensaje: `Estado actualizado correctamente.`,
    usuario: normalizeUsuario(usuario),
  };
};

// ── Eliminar cuenta ───────────────────────────────────────────
const eliminarCuenta = async (id, adminId) => {
  const usuario = await Usuario.findByPk(id);
  if (!usuario) throw Object.assign(new Error('Usuario no encontrado.'), { status: 404 });
  if (usuario.Email === 'admin@kafeancestral.com' || usuario.Email === 'infokcafeancestral@gmail.com') {
    throw Object.assign(new Error('No se puede eliminar la cuenta de este administrador protegido.'), { status: 403 });
  }
  if (parseInt(id) === parseInt(adminId)) {
    throw Object.assign(new Error('No puedes eliminar tu propia cuenta.'), { status: 400 });
  }

  const reservasActivas = await Reserva.count({
    where: { UsuarioIdusuario: id, IdEstadoReserva: { [Op.in]: [1, 2] } }
  });
  if (reservasActivas > 0) {
    throw Object.assign(new Error('No se puede eliminar un cliente con reservas activas.'), { status: 400 });
  }

  await usuario.destroy();
  return { mensaje: 'Cuenta eliminada correctamente.' };
};

// ── Restablecer contraseña (admin genera token) ───────────────
const generarResetAdmin = async (id) => {
  if (parseInt(id) === 1) throw Object.assign(new Error('No se puede restablecer la contraseña del administrador principal por este medio.'), { status: 403 });
  const usuario = await Usuario.findByPk(id);
  if (!usuario) throw Object.assign(new Error('Usuario no encontrado.'), { status: 404 });

  const resetToken  = crypto.randomBytes(32).toString('hex');
  const tokenHashed = crypto.createHash('sha256').update(resetToken).digest('hex');
  const expira      = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

  await usuario.update({ ResetToken: tokenHashed, ResetTokenExpira: expira });

  // Enviar email de invitación para restablecer contraseña
  emailService.enviarInvitacionCuenta({
    to: usuario.Email,
    nombre: usuario.NombreUsuario,
    token: resetToken,
  }).catch(err => console.error('Error enviando email de reset:', err.message));

  return {
    mensaje: `Se envió un correo a ${usuario.Email} con un enlace válido por 10 minutos para restablecer la contraseña.`,
    email:   usuario.Email,
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
  estado:          u.Estado,
});

module.exports = { buscarPorEmail, crearUsuario, cambiarRol, cambiarEstado, eliminarCuenta, generarResetAdmin, listarUsuarios };
