const express = require('express');
const router  = express.Router();
const {
  getAllPackages,
  getPackageById,
  createPackage,
  updatePackage,
  changePackageStatus,
  deletePackage,
} = require('../controllers/packageController');
const {
  validateCreatePackage,
  validateUpdatePackage,
  validatePackageStatus,
} = require('../validator/packageValidator');

router.get('/',               getAllPackages);
router.get('/:id',            getPackageById);
router.post('/',              validateCreatePackage, createPackage);
router.put('/:id',            validateUpdatePackage, updatePackage);
router.patch('/:id/estado',   validatePackageStatus, changePackageStatus);
router.delete('/:id',         deletePackage);

module.exports = router;