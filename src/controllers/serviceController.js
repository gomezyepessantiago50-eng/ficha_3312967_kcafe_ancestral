const serviceService = require('../services/serviceService');

const getAllServices = async (req, res, next) => {
  try {
    const servicios = await serviceService.findAllServices();
    return res.status(200).json({ success: true, data: servicios });
  } catch (error) { next(error); }
};

const getServiceById = async (req, res, next) => {
  try {
    const servicio = await serviceService.findServiceById(req.params.id);
    if (!servicio) return res.status(404).json({ success: false, message: 'Servicio no encontrado.' });
    return res.status(200).json({ success: true, data: servicio });
  } catch (error) { next(error); }
};

const createService = async (req, res, next) => {
  try {
    const nuevo = await serviceService.createService(req.body);
    return res.status(201).json({ success: true, message: 'Servicio creado correctamente.', data: nuevo });
  } catch (error) { next(error); }
};

const updateService = async (req, res, next) => {
  try {
    const servicio = await serviceService.updateService(req.params.id, req.body);
    if (!servicio) return res.status(404).json({ success: false, message: 'Servicio no encontrado.' });
    return res.status(200).json({ success: true, message: 'Servicio actualizado correctamente.', data: servicio });
  } catch (error) { next(error); }
};

const changeServiceStatus = async (req, res, next) => {
  try {
    const servicio = await serviceService.changeServiceStatus(req.params.id, req.body.Estado);
    if (!servicio) return res.status(404).json({ success: false, message: 'Servicio no encontrado.' });
    return res.status(200).json({ success: true, message: `Estado actualizado a ${req.body.Estado ? '"activo"' : '"inactivo"'}.`, data: servicio });
  } catch (error) { next(error); }
};

const deleteService = async (req, res, next) => {
  try {
    const resultado = await serviceService.deleteService(req.params.id);
    if (!resultado) return res.status(404).json({ success: false, message: 'Servicio no encontrado.' });
    return res.status(200).json({ success: true, message: 'Servicio eliminado correctamente.' });
  } catch (error) { next(error); }
};

module.exports = { getAllServices, getServiceById, createService, updateService, changeServiceStatus, deleteService };
