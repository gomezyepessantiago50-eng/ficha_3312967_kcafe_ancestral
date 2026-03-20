const clientService = require('../services/clientService');

/**
 * GET /clientes
 * Lista todos los clientes
 */
const getAllClients = async (req, res, next) => {
  try {
    const clientes = await clientService.findAllClients();

    return res.status(200).json({
      success: true,
      data:    clientes,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /clientes/search?q=texto
 * Busca clientes por nombre, apellido o correo
 */
const searchClients = async (req, res, next) => {
  try {
    const { q } = req.query;

    if (!q || q.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'El parámetro de búsqueda "q" es requerido.',
      });
    }

    const clientes = await clientService.searchByQuery(q.trim());

    return res.status(200).json({
      success: true,
      data:    clientes,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /clientes/:nroDocumento
 * Perfil del cliente: info personal + historial de reservas
 */
const getClientById = async (req, res, next) => {
  try {
    const { nroDocumento } = req.params;

    const cliente = await clientService.findClientWithReservations(nroDocumento);

    if (!cliente) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado.',
      });
    }

    return res.status(200).json({
      success: true,
      data:    cliente,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /clientes/:nroDocumento/historial
 * Solo el historial de reservas del cliente
 */
const getClientHistory = async (req, res, next) => {
  try {
    const { nroDocumento } = req.params;

    const resultado = await clientService.findClientHistory(nroDocumento);

    if (!resultado) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado.',
      });
    }

    return res.status(200).json({
      success: true,
      data:    resultado,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /clientes/:nroDocumento
 * Actualiza datos de contacto del cliente (solo admin)
 */
const updateClient = async (req, res, next) => {
  try {
    const { nroDocumento } = req.params;

    const cliente = await clientService.updateClientData(nroDocumento, req.body);

    if (!cliente) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Cliente actualizado correctamente.',
      data:    cliente,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllClients,
  searchClients,
  getClientById,
  getClientHistory,
  updateClient,
};
