const cabanaService = require('../services/cabanaService');

const getAllCabanas = async (req, res, next) => {
  try {
    const cabanas = await cabanaService.findAllCabanas();
    return res.status(200).json({ success: true, data: cabanas });
  } catch (error) { next(error); }
};

const getCabanaById = async (req, res, next) => {
  try {
    const cabana = await cabanaService.findCabanaById(req.params.id);
    if (!cabana) return res.status(404).json({ success: false, message: 'Cabaña no encontrada.' });
    return res.status(200).json({ success: true, data: cabana });
  } catch (error) { next(error); }
};

const createCabana = async (req, res, next) => {
  try {
    const newCabana = await cabanaService.createCabana(req.body);
    return res.status(201).json({ success: true, message: 'Cabaña creada correctamente', data: newCabana });
  } catch (error) { next(error); }
};

const updateCabana = async (req, res, next) => {
  try {
    const updated = await cabanaService.updateCabana(req.params.id, req.body);
    if (!updated) return res.status(404).json({ success: false, message: 'Cabaña no encontrada.' });
    return res.status(200).json({ success: true, message: 'Cabaña actualizada.', data: updated });
  } catch (error) { next(error); }
};

const changeCabanaStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { Estado } = req.body;
    
    // We can use updateCabana for status change
    const updated = await cabanaService.updateCabana(id, { Estado });
    if (!updated) return res.status(404).json({ success: false, message: 'Cabaña no encontrada.' });
    return res.status(200).json({ success: true, message: 'Estado de cabaña actualizado.', data: updated });
  } catch (error) { next(error); }
};

const deleteCabana = async (req, res, next) => {
  try {
    const result = await cabanaService.deleteCabana(req.params.id);
    if (!result) return res.status(404).json({ success: false, message: 'Cabaña no encontrada.' });
    return res.status(200).json({ success: true, message: 'Cabaña eliminada correctamente.' });
  } catch (error) { next(error); }
};

module.exports = { getAllCabanas, getCabanaById, createCabana, updateCabana, changeCabanaStatus, deleteCabana };
