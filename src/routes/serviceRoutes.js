const express    = require('express');
const router     = express.Router();
const {
  getAllServices,
  getServiceById,
  createService,
  updateService,
  changeServiceStatus,
  deleteService,
} = require('../controllers/serviceController');
const { validateCreateService, validateUpdateService, validateServiceStatus } = require('../validator/serviceValidator');

router.get('/',          getAllServices);
router.get('/:id',       getServiceById);
router.post('/',         validateCreateService, createService);
router.put('/:id',       validateUpdateService, updateService);
router.patch('/:id/estado', validateServiceStatus, changeServiceStatus);
router.delete('/:id',    deleteService);

module.exports = router;
