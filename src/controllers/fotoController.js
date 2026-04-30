const fotoService = require('../services/fotoService');

// GET /habitaciones/:id/fotos
const getFotos = async (req, res, next) => {
  try {
    const { id } = req.params;
    const fotos = await fotoService.getFotosByHabitacion(id);
    return res.status(200).json({ success: true, data: fotos });
  } catch (error) {
    next(error);
  }
};

// POST /habitaciones/:id/fotos
const uploadFoto = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No se enviaron imágenes.' });
    }

    const fotos = [];
    for (let i = 0; i < req.files.length; i++) {
      const foto = await fotoService.addFoto(id, req.files[i].filename, i);
      fotos.push(foto);
    }

    return res.status(201).json({ success: true, message: 'Fotos subidas correctamente.', data: fotos });
  } catch (error) {
    next(error);
  }
};

// DELETE /fotos/:idFoto
const deleteFoto = async (req, res, next) => {
  try {
    const { idFoto } = req.params;
    const resultado = await fotoService.deleteFoto(idFoto);
    if (!resultado) {
      return res.status(404).json({ success: false, message: 'Foto no encontrada.' });
    }
    return res.status(200).json({ success: true, message: 'Foto eliminada correctamente.' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getFotos, uploadFoto, deleteFoto };