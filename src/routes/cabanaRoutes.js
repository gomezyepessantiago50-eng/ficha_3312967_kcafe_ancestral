const express = require('express');
const router  = express.Router();
const {
  getAllCabanas,
  getCabanaById,
  createCabana,
  updateCabana,
  changeCabanaStatus,
  deleteCabana,
} = require('../controllers/cabanaController');

router.get('/', getAllCabanas);
router.get('/:id', getCabanaById);
router.post('/', createCabana);
router.put('/:id', updateCabana);
router.patch('/:id/estado', changeCabanaStatus);
router.delete('/:id', deleteCabana);

module.exports = router;
