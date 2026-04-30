const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

// Crear carpeta uploads si no existe
const uploadDir = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext       = path.extname(file.originalname);
    const nombre    = `hab-${Date.now()}${ext}`;
    cb(null, nombre);
  },
});

const fileFilter = (req, file, cb) => {
  const permitidos = /jpeg|jpg|png|webp/;
  const esValido   = permitidos.test(path.extname(file.originalname).toLowerCase());
  if (esValido) cb(null, true);
  else cb(new Error('Solo se permiten imágenes (jpg, png, webp)'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB máximo
});

module.exports = upload;