// services/reserva.service.js
// Todo se maneja sobre la tabla Reserva usando IdEstadoReserva:
//   1 = Pendiente | 2 = Confirmada | 3 = Cancelada | 4 = Completada | 5 = Bloqueada
const { Op } = require('sequelize');
const Reserva = require('../models/reserva.model');

const ESTADO_MAP = {
  1: 'pendiente',
  2: 'confirmada',
  3: 'cancelada',
  4: 'completada',
  5: 'bloqueada',
};

const parseDateOnly = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  }
  const [year, month, day] = String(value).split('-').map(Number);
  if ([year, month, day].every((n) => Number.isInteger(n) && !Number.isNaN(n))) {
    return new Date(Date.UTC(year, month - 1, day));
  }
  const date = new Date(value);
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
};

const toDateString = (value) => {
  if (!value) return null;
  const date = parseDateOnly(value);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
};

const rangeDates = (start, end) => {
  const dates = [];
  let current = parseDateOnly(start);
  const last = parseDateOnly(end);
  while (current <= last) {
    dates.push(toDateString(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
};

const normalizeReserva = (r) => ({
  id: r.IdReserva,
  documento: r.NroDocumentoCliente,
  fecha_reserva: toDateString(r.FechaReserva),
  fecha_inicio: toDateString(r.FechaInicio),
  fecha_fin: toDateString(r.FechaFinalizacion),
  subtotal: r.SubTotal,
  descuento: r.Descuento,
  iva: r.IVA,
  monto_total: r.MontoTotal,
  metodo_pago: r.MetodoPago,
  estado: ESTADO_MAP[r.IdEstadoReserva] || 'pendiente',
  usuario_id: r.UsuarioIdusuario,
  cabana: r.cabana,
  paquete: r.paquete,
  servicios: r.servicios,
  notas: r.notas,
  num_personas: r.num_personas,
  motivo: r.motivo,
});

const STATE_TO_ID = {
  pendiente: 1,
  confirmada: 2,
  cancelada: 3,
  completada: 4,
  bloqueada: 5,
};

const normalizeBloqueo = (r) => ({
  id: r.IdReserva,
  fecha_inicio: toDateString(r.FechaInicio),
  fecha_fin: toDateString(r.FechaFinalizacion),
  motivo: r.motivo,
  estado: ESTADO_MAP[r.IdEstadoReserva] || 'bloqueada',
});

const parsePayload = (datos) => {
  const payload = {
    NroDocumentoCliente: datos.NroDocumentoCliente || datos.documento || 'demo123',
    FechaInicio: datos.FechaInicio || datos.fecha_inicio,
    FechaFinalizacion: datos.FechaFinalizacion || datos.fecha_fin || datos.FechaFinalizacion,
    SubTotal: datos.SubTotal ?? datos.subtotal ?? 0,
    Descuento: datos.Descuento ?? datos.descuento ?? 0,
    IVA: datos.IVA ?? datos.iva ?? 0,
    MontoTotal: datos.MontoTotal ?? datos.monto_total ?? 0,
    MetodoPago: datos.MetodoPago || datos.metodo_pago || 1,
    UsuarioIdusuario: datos.UsuarioIdusuario || datos.usuario_id || 1,
    cabana: datos.cabana,
    paquete: datos.paquete,
    servicios: datos.servicios,
    notas: datos.notas,
    num_personas: datos.num_personas,
    motivo: datos.Motivo || datos.motivo,
  };

  const estadoValor = datos.estado || datos.Estado;
  if (estadoValor) {
    const estadoId = STATE_TO_ID[String(estadoValor).toLowerCase()];
    if (estadoId) payload.IdEstadoReserva = estadoId;
  }

  return payload;
};

const isTodayOrEarlier = (value) => {
  const dateString = toDateString(value);
  if (!dateString) return false;
  const today = new Date();
  const todayString = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`;
  return dateString <= todayString;
};

const verificarDisponibilidad = async (fechaInicio, fechaFin, cabana = null, excluirId = null) => {
  const inicio = toDateString(fechaInicio);
  const fin = toDateString(fechaFin);

  const fechaOverlap = {
    [Op.and]: [
      { FechaInicio: { [Op.lt]: fin } },
      { FechaFinalizacion: { [Op.gt]: inicio } },
    ],
  };

  const cabanaMatch = cabana
    ? { [Op.or]: [{ IdEstadoReserva: 5 }, { cabana }] }
    : { IdEstadoReserva: 5 };

  const where = {
    IdEstadoReserva: { [Op.in]: [1, 2, 5] },
    [Op.and]: [fechaOverlap, cabanaMatch],
  };

  if (excluirId) where.IdReserva = { [Op.ne]: excluirId };
  const conflictos = await Reserva.findAll({ where });

  return { disponible: conflictos.length === 0, conflictos };
};

const calcularTotal = (subtotal, descuento = 0, iva = 0) => {
  const base = parseFloat(subtotal) || 0;
  const desc = parseFloat(descuento) || 0;
  const ivaPct = parseFloat(iva) || 0;
  const neto = base - desc;
  return parseFloat((neto + neto * (ivaPct / 100)).toFixed(2));
};

const verDisponibilidad = async () => {
  const registros = await Reserva.findAll({
    where: { IdEstadoReserva: { [Op.in]: [1, 2, 5] } },
    attributes: ['IdReserva', 'FechaInicio', 'FechaFinalizacion', 'IdEstadoReserva'],
  });

  const reservadas = registros
    .filter(r => [1, 2].includes(r.IdEstadoReserva))
    .flatMap(r => rangeDates(r.FechaInicio, r.FechaFinalizacion));

  const bloqueadas = registros
    .filter(r => r.IdEstadoReserva === 5)
    .flatMap(r => rangeDates(r.FechaInicio, r.FechaFinalizacion));

  return { reservadas: [...new Set(reservadas)], bloqueadas: [...new Set(bloqueadas)] };
};

const bloquearFechas = async (datos, usuarioId) => {
  const payload = parsePayload(datos);
  const { FechaInicio, FechaFinalizacion, motivo } = payload;
  const { disponible, conflictos } = await verificarDisponibilidad(FechaInicio, FechaFinalizacion);
  if (!disponible) {
    const error = new Error('Ya existen reservas o bloqueos en ese rango de fechas');
    error.status = 409;
    error.conflictos = conflictos;
    throw error;
  }

  const bloqueo = await Reserva.create({
    NroDocumentoCliente: null,
    FechaInicio,
    FechaFinalizacion,
    FechaReserva: new Date(),
    IdEstadoReserva: 5,
    UsuarioIdusuario: usuarioId,
    SubTotal: 0,
    Descuento: 0,
    IVA: 0,
    MontoTotal: 0,
    MetodoPago: 1,
    motivo,
  });

  return normalizeBloqueo(bloqueo);
};

const desbloquearFechas = async (id) => {
  const bloqueo = await Reserva.findOne({ where: { IdReserva: id, IdEstadoReserva: 5 } });
  if (!bloqueo) {
    const error = new Error('Bloqueo no encontrado');
    error.status = 404;
    throw error;
  }

  await bloqueo.update({ IdEstadoReserva: 3 });
  return { mensaje: 'Fechas desbloqueadas correctamente' };
};

const crearReserva = async (datos, usuarioId = 1) => {
  const payload = parsePayload(datos);
  const { FechaInicio, FechaFinalizacion, SubTotal, Descuento, IVA, cabana } = payload;

  if (isTodayOrEarlier(FechaInicio)) {
    const error = new Error('La fecha de inicio debe ser a partir de mañana');
    error.status = 400;
    throw error;
  }

  const { disponible, conflictos } = await verificarDisponibilidad(FechaInicio, FechaFinalizacion, cabana);
  if (!disponible) {
    const error = new Error('No permitido: misma fecha y misma cabaña o bloqueo en esas fechas');
    error.status = 409;
    error.conflictos = conflictos;
    throw error;
  }

  payload.MontoTotal = calcularTotal(SubTotal, Descuento, IVA);
  payload.FechaReserva = new Date();
  payload.IdEstadoReserva = 1;
  payload.UsuarioIdusuario = usuarioId;

  const reserva = await Reserva.create(payload);
  return normalizeReserva(reserva);
};

const listarReservas = async (filtros = {}, paginacion = {}) => {
  const estadoId = ({ pendiente: 1, confirmada: 2, cancelada: 3, completada: 4, bloqueada: 5 })[filtros.estado];
  const where = { IdEstadoReserva: { [Op.ne]: 5 } };

  if (estadoId) where.IdEstadoReserva = estadoId;
  if (filtros.documento) where.NroDocumentoCliente = { [Op.like]: `%${filtros.documento}%` };
  if (filtros.fechaDesde) where.FechaInicio = { [Op.gte]: filtros.fechaDesde };
  if (filtros.fechaHasta) where.FechaFinalizacion = { [Op.lte]: filtros.fechaHasta };

  // Obtener total de registros para paginación
  const total = await Reserva.count({ where });

  // Aplicar paginación
  const { limit = 5, offset = 0 } = paginacion;
  const reservas = await Reserva.findAll({
    where,
    order: [['FechaReserva', 'DESC']],
    limit,
    offset
  });

  const totalPages = Math.ceil(total / limit);

  return {
    reservas: reservas.map(normalizeReserva),
    total,
    totalPages,
    currentPage: Math.floor(offset / limit) + 1
  };
};

const listarBloqueos = async () => {
  const bloqueos = await Reserva.findAll({ where: { IdEstadoReserva: 5 }, order: [['FechaInicio', 'ASC']] });
  return bloqueos.map(normalizeBloqueo);
};

const misReservas = async (usuarioId) => {
  const where = { IdEstadoReserva: { [Op.ne]: 5 } };
  if (usuarioId) where.UsuarioIdusuario = usuarioId;
  const reservas = await Reserva.findAll({ where, order: [['FechaReserva', 'DESC']] });
  return reservas.map(normalizeReserva);
};

const obtenerReserva = async (id) => {
  const reserva = await Reserva.findByPk(id);
  if (!reserva) {
    const error = new Error('Reserva no encontrada');
    error.status = 404;
    throw error;
  }
  return normalizeReserva(reserva);
};

const editarReserva = async (id, datos) => {
  const reserva = await Reserva.findByPk(id);
  if (!reserva) {
    const error = new Error('Reserva no encontrada');
    error.status = 404;
    throw error;
  }

  if ([3, 4, 5].includes(reserva.IdEstadoReserva)) {
    const error = new Error('No se puede editar una reserva cancelada, completada o bloqueada');
    error.status = 400;
    throw error;
  }

  const payload = parsePayload(datos);
  if (payload.FechaInicio || payload.FechaFinalizacion || payload.cabana) {
    const inicio = payload.FechaInicio || reserva.FechaInicio;
    const fin = payload.FechaFinalizacion || reserva.FechaFinalizacion;
    const cabana = payload.cabana || reserva.cabana;

    if (payload.FechaInicio && isTodayOrEarlier(payload.FechaInicio)) {
      const error = new Error('La fecha de inicio debe ser a partir de mañana');
      error.status = 400;
      throw error;
    }

    const { disponible } = await verificarDisponibilidad(inicio, fin, cabana, id);
    if (!disponible) {
      const error = new Error('No permitido: misma fecha y misma cabaña o bloqueo en esas fechas');
      error.status = 409;
      throw error;
    }
  }

  if (payload.SubTotal || payload.Descuento || payload.IVA) {
    payload.MontoTotal = calcularTotal(
      payload.SubTotal ?? reserva.SubTotal,
      payload.Descuento ?? reserva.Descuento,
      payload.IVA ?? reserva.IVA,
    );
  }

  await reserva.update(payload);
  return normalizeReserva(reserva);
};

const eliminarReserva = async (id) => {
  const reserva = await Reserva.findOne({ where: { IdReserva: id, IdEstadoReserva: { [Op.ne]: 5 } } });
  if (!reserva) {
    const error = new Error('Reserva no encontrada');
    error.status = 404;
    throw error;
  }

  if (reserva.IdEstadoReserva === 3) {
    const error = new Error('La reserva ya está cancelada');
    error.status = 400;
    throw error;
  }

  await reserva.update({ IdEstadoReserva: 3 });
  return { mensaje: 'Reserva cancelada correctamente' };
};

module.exports = {
  verDisponibilidad,
  bloquearFechas,
  desbloquearFechas,
  crearReserva,
  listarReservas,
  listarBloqueos,
  misReservas,
  obtenerReserva,
  editarReserva,
  eliminarReserva,
};
