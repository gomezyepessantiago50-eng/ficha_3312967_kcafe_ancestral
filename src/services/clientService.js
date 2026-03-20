const { Clientes } = require('../models');
const { Op } = require('sequelize');

const findAllClients = async () => {
  try {
    const result = await Clientes.findAll({
      attributes: ['NroDocumento', 'Nombre', 'Apellido', 'Email', 'Telefono', 'Direccion', 'Estado', 'TipoDocumento'],
      order: [['Nombre', 'ASC']],
    });
    return result;
  } catch (error) {
    console.error('Error en findAllClients:', error.message);
    throw error;
  }
};

const searchByQuery = async (q) => {
  return Clientes.findAll({
    where: {
      [Op.or]: [
        { Nombre:   { [Op.like]: `%${q}%` } },
        { Apellido: { [Op.like]: `%${q}%` } },
        { Email:    { [Op.like]: `%${q}%` } },
      ],
    },
    attributes: ['NroDocumento', 'Nombre', 'Apellido', 'Email', 'Telefono', 'Estado', 'TipoDocumento'],
    order: [['Nombre', 'ASC']],
  });
};

const findClientWithReservations = async (nroDocumento) => {
  return Clientes.findByPk(nroDocumento, {
    attributes: [
      'NroDocumento', 'Nombre', 'Apellido', 'Email',
      'Telefono', 'Direccion', 'Estado', 'TipoDocumento',
    ],
  });
};

const findClientHistory = async (nroDocumento) => {
  const cliente = await Clientes.findByPk(nroDocumento, {
    attributes: ['NroDocumento', 'Nombre', 'Apellido', 'Email'],
  });

  if (!cliente) return null;

  return { cliente, reservas: [] };
};

const updateClientData = async (nroDocumento, data) => {
  const cliente = await Clientes.findByPk(nroDocumento);
  if (!cliente) return null;

  const { Nombre, Apellido, Direccion, Email, Telefono, TipoDocumento, Estado } = data;

  await cliente.update({
    ...(Nombre         !== undefined && { Nombre }),
    ...(Apellido       !== undefined && { Apellido }),
    ...(Direccion      !== undefined && { Direccion }),
    ...(Email          !== undefined && { Email }),
    ...(celular       !== undefined && { celular }),
    ...(TipoDocumento  !== undefined && { TipoDocumento }),
    ...(Estado         !== undefined && { Estado }),
  });

  return cliente;
};

module.exports = {
  findAllClients,
  searchByQuery,
  findClientWithReservations,
  findClientHistory,
  updateClientData,
};