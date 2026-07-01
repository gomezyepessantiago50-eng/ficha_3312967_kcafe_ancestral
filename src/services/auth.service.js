// src/services/auth.service.js
'use strict';

const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const Usuario = require('../models/usuario.model');
const { Op }  = require('sequelize');
const emailService = require('./email.service');
const { OAuth2Client } = require('google-auth-library');
const Reserva = require('../models/reserva.model');

const googleClient = new OAuth2Client('713503730078-7d7ha55ugb2vaoj9ophdp28o6pn98m7h.apps.googleusercontent.com');

// ── OTP Store en memoria ─────────────────────────────────────
const otpStore = new Map(); // email => { code: string, expiresAt: number }

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
  rol:    Number(usuario.IDRol) === 1 ? 'admin' : 'cliente',
  idRol:  usuario.IDRol,
  IDRol:  usuario.IDRol,
});

// ── SEND OTP ──────────────────────────────────────────────────
const sendRegistrationOtp = async ({ email, nombre }) => {
  // Verificar si el email ya existe
  const existeEmail = await Usuario.findOne({ where: { Email: email } });
  if (existeEmail) throw new Error('El correo electrónico ya está registrado con otra cuenta.');

  // Generar código de 6 dígitos
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore.set(email, { code, expiresAt: Date.now() + 10 * 60 * 1000 }); // Expiración en 10 min

  // Enviar el correo
  try {
    await emailService.enviarCodigoVerificacion({ to: email, nombre, codigo: code });
    return { mensaje: 'Código enviado exitosamente. Revisa tu bandeja de entrada.' };
  } catch (error) {
    console.error('Error enviando el código de confirmación:', error.message);
    otpStore.delete(email);
    throw new Error('No se pudo enviar el correo de confirmación. Intenta de nuevo más tarde.');
  }
};

// ── REGISTRO ─────────────────────────────────────────────────
const registro = async ({ nombre, apellido, email, password, telefono, tipoDocumento, numeroDocumento, pais, direccion, idRol, otpCode }) => {
  if (!otpCode) {
    throw new Error('El código de verificación es obligatorio.');
  }

  const storedOtp = otpStore.get(email);
  if (!storedOtp) {
    throw new Error('No se ha solicitado o ha expirado el código para este correo.');
  }

  if (storedOtp.expiresAt < Date.now()) {
    otpStore.delete(email);
    throw new Error('El código de verificación ha expirado. Solicita uno nuevo.');
  }

  if (storedOtp.code !== otpCode) {
    throw new Error('El código de verificación es incorrecto.');
  }

  // Verificar si el email ya existe
  const existeEmail = await Usuario.findOne({ where: { Email: email } });
  if (existeEmail) throw new Error('El correo electrónico ya está registrado con otra cuenta.');

  if (numeroDocumento) {
    const existeDoc = await Usuario.findOne({ where: { NumeroDocumento: numeroDocumento } });
    if (existeDoc) throw new Error('El número de documento ya está registrado con otra cuenta.');
  }

  if (telefono) {
    const existeTel = await Usuario.findOne({ where: { Telefono: telefono } });
    if (existeTel) throw new Error('El teléfono ya está registrado con otra cuenta.');
  }

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

  // Eliminar el código usado
  otpStore.delete(email);

  const token = signToken(buildUserPayload(usuario));

  // Enviar email de confirmación de cuenta
  emailService.enviarConfirmacionCuenta({
    to: email, 
    nombre, 
    apellido, 
    tipoDocumento, 
    numeroDocumento, 
    pais, 
    telefono
  }).catch(err => console.error('Error enviando email de bienvenida:', err.message));

  return {
    token,
    usuario: {
      id:     usuario.IDUsuario,
      nombre: usuario.NombreUsuario,
      email:  usuario.Email,
      rol:    Number(usuario.IDRol) === 1 ? 'admin' : 'cliente',
    },
  };
};

// ── GOOGLE LOGIN / REGISTER ───────────────────────────────────
const googleLogin = async ({ token, tipoDocumento, numeroDocumento, pais, telefono }) => {
  // Verificar token de Google
  const ticket = await googleClient.verifyIdToken({
    idToken: token,
    audience: '713503730078-7d7ha55ugb2vaoj9ophdp28o6pn98m7h.apps.googleusercontent.com',
  });
  
  const payload = ticket.getPayload();
  const { email, given_name, family_name } = payload;

  let usuario = await Usuario.findOne({ where: { Email: email } });

  if (usuario) {
    // Si la cuenta existe, verificar estado
    if (usuario.Estado === false || usuario.Estado === 0 || usuario.Estado === 'inactivo') {
      throw new Error('Tu cuenta ha sido desactivada. Por favor contacta al administrador.');
    }
  } else {
    // Si no existe, requerir los datos extras obligatorios
    if (!tipoDocumento || !numeroDocumento || !pais) {
      return { 
        require_extra_data: true, 
        email, 
        nombre: given_name, 
        apellido: family_name 
      };
    }

    if (numeroDocumento) {
      const existeDoc = await Usuario.findOne({ where: { NumeroDocumento: numeroDocumento } });
      if (existeDoc) throw new Error('El número de documento ya está registrado con otra cuenta.');
    }

    if (telefono) {
      const existeTel = await Usuario.findOne({ where: { Telefono: telefono } });
      if (existeTel) throw new Error('El teléfono ya está registrado con otra cuenta.');
    }

    // Si ya enviaron los datos extras, procedemos a crear la cuenta
    const randomPassword = crypto.randomBytes(16).toString('hex') + 'G!1a';
    const hash = await bcrypt.hash(randomPassword, 12);

    usuario = await Usuario.create({
      NombreUsuario:   given_name,
      Apellido:        family_name || null,
      Email:           email,
      Contrasena:      hash,
      TipoDocumento:   tipoDocumento,
      NumeroDocumento: numeroDocumento,
      Pais:            pais,
      Telefono:        telefono || null,
      IDRol:           2, // Cliente
      Estado:          true
    });

    // Enviar email de confirmación de cuenta
    emailService.enviarConfirmacionCuenta({ 
      to: email, 
      nombre: given_name,
      apellido: family_name || null,
      tipoDocumento,
      numeroDocumento,
      pais,
      telefono
    }).catch(err => console.error('Error enviando email de bienvenida:', err.message));
  }

  const jwtToken = signToken(buildUserPayload(usuario));

  return {
    token: jwtToken,
    usuario: {
      id:     usuario.IDUsuario,
      nombre: usuario.NombreUsuario,
      email:  usuario.Email,
      rol:    Number(usuario.IDRol) === 1 ? 'admin' : 'cliente',
    },
  };
};

// ── LOGIN ─────────────────────────────────────────────────────
const login = async ({ email, password }) => {
  // Buscar usuario
  const usuario = await Usuario.findOne({ where: { Email: email } });
  if (!usuario) throw new Error('No existe una cuenta con este correo.');

  // Check if account is inactive
  if (usuario.Estado === false || usuario.Estado === 0 || usuario.Estado === 'inactivo') {
    throw new Error('Tu cuenta ha sido desactivada. Por favor contacta al administrador.');
  }

  // Verificar contraseña
  const valida = await bcrypt.compare(password, usuario.Contrasena);
  if (!valida) throw new Error('La contraseña es incorrecta.');

  const token = signToken(buildUserPayload(usuario));

  return {
    token,
    usuario: {
      id:     usuario.IDUsuario,
      nombre: usuario.NombreUsuario,
      apellido: usuario.Apellido,
      email:  usuario.Email,
      rol:    Number(usuario.IDRol) === 1 ? 'admin' : 'cliente',
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
    throw new Error('No existe una cuenta con este correo.');
  }

  // Generar token único
  const resetToken  = crypto.randomBytes(32).toString('hex');
  const tokenHashed = crypto.createHash('sha256').update(resetToken).digest('hex');
  const expira      = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

  await usuario.update({
    ResetToken:       tokenHashed,
    ResetTokenExpira: expira,
  });

  // Enviar email con el token
  emailService.enviarRecuperacionPassword({
    to: email,
    nombre: usuario.NombreUsuario,
    token: resetToken
  }).catch(err => console.error('Error enviando email de recuperacion:', err.message));


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
    DocumentoModificado: usuario.DocumentoModificado,
    rol:             Number(usuario.IDRol) === 1 ? 'admin' : 'cliente',
    idRol:           usuario.IDRol,
  };
};

// ── ACTUALIZAR PERFIL ─────────────────────────────────────────
const actualizarPerfil = async (idUsuario, datos) => {
  const usuario = await Usuario.findByPk(idUsuario);
  if (!usuario) throw new Error('Usuario no encontrado.');

  const { nombre, apellido, email, telefono, tipoDocumento, numeroDocumento, pais } = datos;

  if (email && email !== usuario.Email) {
    const existeEmail = await Usuario.findOne({ where: { Email: email } });
    if (existeEmail && String(existeEmail.IDUsuario) !== String(idUsuario)) {
      throw new Error('El correo electrónico ya está registrado con otra cuenta.');
    }
  }

  let documentoModificadoFlag = usuario.DocumentoModificado;

  const docCambiado = (numeroDocumento && String(numeroDocumento) !== String(usuario.NumeroDocumento)) ||
                      (tipoDocumento && tipoDocumento !== usuario.TipoDocumento);

  if (docCambiado) {
    if (usuario.DocumentoModificado) {
      throw new Error('El tipo y número de documento solo pueden ser modificados una vez por seguridad.');
    }
    const existeDoc = await Usuario.findOne({ where: { NumeroDocumento: numeroDocumento } });
    if (existeDoc && String(existeDoc.IDUsuario) !== String(idUsuario)) {
      throw new Error('El número de documento ya está registrado con otra cuenta.');
    }
    
    documentoModificadoFlag = true;
  }

  if (telefono && telefono !== usuario.Telefono) {
    const existeTel = await Usuario.findOne({ where: { Telefono: telefono } });
    if (existeTel && String(existeTel.IDUsuario) !== String(idUsuario)) {
      throw new Error('El teléfono ya está registrado con otra cuenta.');
    }
  }

  await usuario.update({
    ...(nombre !== undefined && { NombreUsuario: nombre }),
    ...(apellido !== undefined && { Apellido: apellido }),
    ...(email !== undefined && { Email: email }),
    ...(telefono !== undefined && { Telefono: telefono }),
    ...(tipoDocumento !== undefined && { TipoDocumento: tipoDocumento }),
    ...(numeroDocumento !== undefined && { NumeroDocumento: numeroDocumento }),
    ...(pais !== undefined && { Pais: pais }),
    DocumentoModificado: documentoModificadoFlag
  });

  return {
    mensaje: 'Perfil actualizado correctamente.',
    usuario: {
      id:              usuario.IDUsuario,
      nombre:          usuario.NombreUsuario,
      apellido:        usuario.Apellido,
      email:           usuario.Email,
      telefono:        usuario.Telefono,
      tipoDocumento:   usuario.TipoDocumento,
      numeroDocumento: usuario.NumeroDocumento,
      pais:            usuario.Pais,
      DocumentoModificado: usuario.DocumentoModificado,
      rol:             Number(usuario.IDRol) === 1 ? 'admin' : 'cliente',
      idRol:           usuario.IDRol,
    }
  };
};

// ── DESACTIVAR CUENTA CLIENTE ─────────────────────────────────
const desactivarCuentaCliente = async (idUsuario) => {
  const usuario = await Usuario.findByPk(idUsuario);
  if (!usuario) throw new Error('Usuario no encontrado.');
  if (usuario.Email === 'admin@kafeancestral.com' || usuario.Email === 'infokcafeancestral@gmail.com') {
    throw new Error('No puedes desactivar el administrador principal.');
  }

  await usuario.update({ Estado: false });
  return { mensaje: 'Cuenta desactivada correctamente.' };
};

// ── ELIMINAR CUENTA CLIENTE ───────────────────────────────────
const eliminarCuentaCliente = async (idUsuario) => {
  const usuario = await Usuario.findByPk(idUsuario);
  if (!usuario) throw new Error('Usuario no encontrado.');
  if (usuario.Email === 'admin@kafeancestral.com' || usuario.Email === 'infokcafeancestral@gmail.com') {
    throw new Error('No puedes eliminar el administrador principal.');
  }

  const reservasConfirmadas = await Reserva.count({
    where: { UsuarioIdusuario: idUsuario, IdEstadoReserva: 2 }
  });
  if (reservasConfirmadas > 0) {
    throw new Error('No puedes eliminar tu cuenta si tienes reservas confirmadas.');
  }

  await usuario.destroy();
  return { mensaje: 'Cuenta eliminada permanentemente.' };
};

module.exports = {
  registro,
  login,
  googleLogin,
  sendRegistrationOtp,
  logout,
  isTokenRevocado,
  recuperarPassword,
  resetPassword,
  perfil,
  actualizarPerfil,
  desactivarCuentaCliente,
  eliminarCuentaCliente,
};
