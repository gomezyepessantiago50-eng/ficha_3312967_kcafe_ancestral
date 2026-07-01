// routes/reserva.routes.js
const router = require('express').Router();
const ctrl   = require('../controllers/reserva.controller');
const {
  crearReservaValidator,
  editarReservaValidator,
  idParamValidator,
  bloquearFechasValidator,
} = require('../validators/reserva.validator');

// Importa tu middleware de autenticación existente
const { verifyToken } = require('../middlewares/auth.middleware');

// ── Disponibilidad (pública para que el cliente vea fechas) ──
router.get('/disponibilidad', ctrl.verDisponibilidad);

// ── Bloqueo de fechas (solo admin) ──
router.get(   '/bloquear',     verifyToken,                         ctrl.listarBloqueos);
router.post(  '/bloquear',     verifyToken, bloquearFechasValidator, ctrl.bloquearFechas);
router.delete('/bloquear/:id', verifyToken, idParamValidator,        ctrl.desbloquearFechas);

// ── CRUD de reservas ──
router.post(  '/',    verifyToken, crearReservaValidator,  ctrl.crearReserva);
router.get(   '/mis-reservas', verifyToken,                 ctrl.misReservas);
router.get(   '/:id', verifyToken,                         ctrl.unaReserva);
router.get(   '/',    verifyToken,                         ctrl.listarReservas);
router.put(   '/:id', verifyToken, editarReservaValidator, ctrl.editarReserva);
router.delete('/:id', verifyToken, idParamValidator,       ctrl.eliminarReserva);

module.exports = router;
