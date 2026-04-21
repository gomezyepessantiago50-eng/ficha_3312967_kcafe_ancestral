// controllers/reserva.controller.js
const { validationResult } = require('express-validator');
const reservaService = require('../services/reserva.service');

// ── Helper respuesta de error de validación ──
const handleValidationErrors = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      ok: false,
      mensaje: 'Datos inválidos',
      errores: errors.array(),
    });
  }
  return null;
};

const verDisponibilidad = async (req, res) => {
  try {
    const data = await reservaService.verDisponibilidad();
    res.status(200).json({ ok: true, data });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, mensaje: error.message });
  }
};

const bloquearFechas = async (req, res) => {
  const errores = handleValidationErrors(req, res);
  if (errores) return;

  try {
    const usuarioId = req.user?.IDUsuario || 1;
    const bloqueo = await reservaService.bloquearFechas(req.body, usuarioId);
    res.status(201).json({ ok: true, mensaje: 'Fechas bloqueadas correctamente', data: bloqueo });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, mensaje: error.message, conflictos: error.conflictos || null });
  }
};

const listarBloqueos = async (req, res) => {
  try {
    const bloqueos = await reservaService.listarBloqueos();
    res.status(200).json({ ok: true, total: bloqueos.length, data: bloqueos });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, mensaje: error.message });
  }
};

const desbloquearFechas = async (req, res) => {
  const errores = handleValidationErrors(req, res);
  if (errores) return;

  try {
    const result = await reservaService.desbloquearFechas(req.params.id);
    res.status(200).json({ ok: true, ...result });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, mensaje: error.message });
  }
};

const crearReserva = async (req, res) => {
  const errores = handleValidationErrors(req, res);
  if (errores) return;

  try {
    const reserva = await reservaService.crearReserva(req.body);
    res.status(201).json({ ok: true, mensaje: 'Reserva creada exitosamente', data: reserva });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, mensaje: error.message, conflictos: error.conflictos || null });
  }
};

const listarReservas = async (req, res) => {
  try {
    const filtros = {
      estado: req.query.estado,
      documento: req.query.documento,
      fechaDesde: req.query.fechaDesde,
      fechaHasta: req.query.fechaHasta,
    };

    // Parámetros de paginación
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5; // 5 por página como solicitado
    const offset = (page - 1) * limit;

    const result = await reservaService.listarReservas(filtros, { page, limit, offset });
    res.status(200).json({
      ok: true,
      total: result.total,
      totalPages: result.totalPages,
      currentPage: page,
      data: result.reservas
    });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, mensaje: error.message });
  }
};

const misReservas = async (req, res) => {
  try {
    const usuarioId = req.user?.IDUsuario || null;
    const reservas = await reservaService.misReservas(usuarioId);
    res.status(200).json({ ok: true, total: reservas.length, data: reservas });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, mensaje: error.message });
  }
};

const unaReserva = async (req, res) => {
  try {
    const reserva = await reservaService.obtenerReserva(req.params.id);
    res.status(200).json({ ok: true, data: reserva });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, mensaje: error.message });
  }
};

const editarReserva = async (req, res) => {
  const errores = handleValidationErrors(req, res);
  if (errores) return;

  try {
    const reserva = await reservaService.editarReserva(req.params.id, req.body);
    res.status(200).json({ ok: true, mensaje: 'Reserva actualizada correctamente', data: reserva });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, mensaje: error.message });
  }
};

const eliminarReserva = async (req, res) => {
  const errores = handleValidationErrors(req, res);
  if (errores) return;

  try {
    const result = await reservaService.eliminarReserva(req.params.id);
    res.status(200).json({ ok: true, ...result });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, mensaje: error.message });
  }
};

module.exports = {
  verDisponibilidad,
  bloquearFechas,
  listarBloqueos,
  desbloquearFechas,
  crearReserva,
  listarReservas,
  misReservas,
  unaReserva,
  editarReserva,
  eliminarReserva,
};
