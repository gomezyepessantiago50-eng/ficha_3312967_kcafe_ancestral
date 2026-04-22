const packageService = require('../services/packageService');

const getAllPackages = async (req, res, next) => {
  try {
    const paquetes = await packageService.findAllPackages();
    return res.status(200).json({ success: true, data: paquetes });
  } catch (error) { next(error); }
};

const getPackageById = async (req, res, next) => {
  try {
    const paquete = await packageService.findPackageById(req.params.id);
    if (!paquete) return res.status(404).json({ success: false, message: 'Paquete no encontrado.' });
    return res.status(200).json({ success: true, data: paquete });
  } catch (error) { next(error); }
};

const createPackage = async (req, res, next) => {
  try {
    const nuevo = await packageService.createPackage(req.body);
    return res.status(201).json({ success: true, message: 'Paquete creado correctamente.', data: nuevo });
  } catch (error) { next(error); }
};

const updatePackage = async (req, res, next) => {
  try {
    const paquete = await packageService.updatePackage(req.params.id, req.body);
    if (!paquete) return res.status(404).json({ success: false, message: 'Paquete no encontrado.' });
    return res.status(200).json({ success: true, message: 'Paquete actualizado correctamente.', data: paquete });
  } catch (error) { next(error); }
};

const changePackageStatus = async (req, res, next) => {
  try {
    const paquete = await packageService.changePackageStatus(req.params.id, req.body.Estado);
    if (!paquete) return res.status(404).json({ success: false, message: 'Paquete no encontrado.' });
    return res.status(200).json({ success: true, message: `Estado actualizado a ${req.body.Estado ? '"activo"' : '"inactivo"'}.`, data: paquete });
  } catch (error) { next(error); }
};

const deletePackage = async (req, res, next) => {
  try {
    const resultado = await packageService.deletePackage(req.params.id);
    if (!resultado) return res.status(404).json({ success: false, message: 'Paquete no encontrado.' });
    return res.status(200).json({ success: true, message: 'Paquete eliminado correctamente.' });
  } catch (error) { next(error); }
};

module.exports = { getAllPackages, getPackageById, createPackage, updatePackage, changePackageStatus, deletePackage };
