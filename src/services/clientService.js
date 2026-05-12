const Usuario = require('../models/usuario.model');
const { Op } = require('sequelize');

/**
 * Encuentra todos los clientes (usuarios con rol 2) con paginación
 */
const findAllClients = async ({ page = 1, limit = 10, q = '' } = {}) => {
  const offset = (page - 1) * limit;

  const where = { IDRol: 2 }; // Solo clientes, no admins

  if (q) {
    where[Op.or] = [
      { NombreUsuario: { [Op.like]: `%${q}%` } },
      { Apellido: { [Op.like]: `%${q}%` } },
      { Email: { [Op.like]: `%${q}%` } },
      { NumeroDocumento: { [Op.like]: `%${q}%` } },
    ];
  }

  const { count, rows } = await Usuario.findAndCountAll({
    where,
    attributes: [
      'IDUsuario', 'NombreUsuario', 'Apellido', 'Email',
      'Telefono', 'TipoDocumento', 'NumeroDocumento',
      'Pais', 'Direccion', 'IDRol',
    ],
    order: [['NombreUsuario', 'ASC']],
    limit,
    offset,
  });

  return {
    clientes: rows.map(normalizeCliente),
    total: count,
    totalPages: Math.ceil(count / limit),
    currentPage: page,
  };
};

/**
 * Busca clientes por nombre, apellido o correo (sin paginación, para el modal de reservas)
 */
const searchByQuery = async (q) => {
  const clientes = await Usuario.findAll({
    where: {
      IDRol: 2,
      [Op.or]: [
        { NombreUsuario: { [Op.like]: `%${q}%` } },
        { Apellido: { [Op.like]: `%${q}%` } },
        { Email: { [Op.like]: `%${q}%` } },
        { NumeroDocumento: { [Op.like]: `%${q}%` } },
      ],
    },
    attributes: [
      'IDUsuario', 'NombreUsuario', 'Apellido', 'Email',
      'Telefono', 'TipoDocumento', 'NumeroDocumento',
      'Pais', 'Direccion', 'IDRol',
    ],
    order: [['NombreUsuario', 'ASC']],
    limit: 50,
  });

  return clientes.map(normalizeCliente);
};

/**
 * Encuentra un cliente por su ID de usuario
 */
const findClientWithReservations = async (id) => {
  const usuario = await Usuario.findOne({
    where: { IDUsuario: id, IDRol: 2 },
    attributes: [
      'IDUsuario', 'NombreUsuario', 'Apellido', 'Email',
      'Telefono', 'TipoDocumento', 'NumeroDocumento',
      'Pais', 'Direccion', 'IDRol',
    ],
  });

  if (!usuario) return null;
  return normalizeCliente(usuario);
};

/**
 * Encuentra historial de un cliente
 */
const findClientHistory = async (id) => {
  const usuario = await Usuario.findOne({
    where: { IDUsuario: id, IDRol: 2 },
    attributes: ['IDUsuario', 'NombreUsuario', 'Apellido', 'Email'],
  });

  if (!usuario) return null;
  return { cliente: normalizeCliente(usuario), reservas: [] };
};

/**
 * Actualiza datos de un cliente (usuario)
 */
const updateClientData = async (id, data) => {
  const usuario = await Usuario.findOne({
    where: { IDUsuario: id, IDRol: 2 },
  });
  if (!usuario) return null;

  const { Nombre, Apellido, Direccion, Email, Telefono, TipoDocumento, Pais } = data;

  await usuario.update({
    ...(Nombre !== undefined && { NombreUsuario: Nombre }),
    ...(Apellido !== undefined && { Apellido }),
    ...(Direccion !== undefined && { Direccion }),
    ...(Email !== undefined && { Email }),
    ...(Telefono !== undefined && { Telefono }),
    ...(TipoDocumento !== undefined && { TipoDocumento }),
    ...(Pais !== undefined && { Pais }),
  });

  return normalizeCliente(usuario);
};

/**
 * Normaliza un usuario a formato de "cliente" para el frontend
 */
const normalizeCliente = (u) => ({
  NroDocumento: u.NumeroDocumento ? String(u.NumeroDocumento) : String(u.IDUsuario),
  IDUsuario: u.IDUsuario,
  Nombre: u.NombreUsuario,
  Apellido: u.Apellido || '',
  Email: u.Email,
  Telefono: u.Telefono || '',
  TipoDocumento: u.TipoDocumento || '',
  NumeroDocumento: u.NumeroDocumento || '',
  Pais: u.Pais || '',
  Direccion: u.Direccion || '',
  Estado: true,
  IDRol: u.IDRol,
});

module.exports = {
  findAllClients,
  searchByQuery,
  findClientWithReservations,
  findClientHistory,
  updateClientData,
};