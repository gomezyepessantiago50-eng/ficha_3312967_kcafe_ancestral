// services/reserva.service.js
// Todo se maneja sobre la tabla Reserva usando IdEstadoReserva:
//   1 = Pendiente | 2 = Confirmada | 3 = Cancelada | 4 = Completada | 5 = Bloqueada
const { Op } = require('sequelize');
const Reserva = require('../models/reserva.model');
const Usuario = require('../models/usuario.model');
const emailService = require('./email.service');

Reserva.belongsTo(Usuario, { foreignKey: 'UsuarioIdusuario', as: 'usuario' });

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
  documento: (r.usuario && r.usuario.NumeroDocumento)
    ? r.usuario.NumeroDocumento
    : r.NroDocumentoCliente,

  cliente_nombre: r.usuario
    ? `${r.usuario.NombreUsuario} ${r.usuario.Apellido || ''}`.trim()
    : null,

  fecha_reserva: r.FechaReserva,
  fecha_inicio: toDateString(r.FechaInicio),
  fecha_fin: toDateString(r.FechaFinalizacion),

  subtotal: r.SubTotal,
  descuento: r.Descuento,
  iva: r.IVA,
  monto_total: r.MontoTotal,

  estado: ESTADO_MAP[r.IdEstadoReserva] || 'pendiente',
  usuario_id: r.UsuarioIdusuario,

  cabana: r.cabana,
  paquete: r.paquete,
  paquetes_extra:
    typeof r.paquetes_extra === 'string'
      ? (() => {
        try {
          return JSON.parse(r.paquetes_extra);
        } catch {
          return [];
        }
      })()
      : (r.paquetes_extra || []),

  servicios:
    typeof r.servicios === 'string'
      ? (() => {
        try {
          return JSON.parse(r.servicios);
        } catch {
          return [];
        }
      })()
      : (r.servicios || []),

  notas: r.notas,
  num_personas: r.num_personas,
  motivo: r.motivo,

  metodo_pago: r.metodo_pago,

  comprobante_pago: r.comprobante_pago,
  monto_pagado: r.monto_pagado,
  pagos_historial:
    typeof r.pagos_historial === 'string'
      ? (() => {
        try {
          return JSON.parse(r.pagos_historial);
        } catch {
          return null;
        }
      })()
      : r.pagos_historial,
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
  cabana: r.cabana,
  estado: ESTADO_MAP[r.IdEstadoReserva] || 'bloqueada',
});

const parsePayload = (datos) => {
  const payload = {};

  if (datos.NroDocumentoCliente !== undefined || datos.documento !== undefined) payload.NroDocumentoCliente = datos.NroDocumentoCliente || datos.documento;
  if (datos.FechaInicio !== undefined || datos.fecha_inicio !== undefined) payload.FechaInicio = datos.FechaInicio || datos.fecha_inicio;
  if (datos.FechaFinalizacion !== undefined || datos.fecha_fin !== undefined) payload.FechaFinalizacion = datos.FechaFinalizacion || datos.fecha_fin;
  if (datos.SubTotal !== undefined || datos.subtotal !== undefined) payload.SubTotal = datos.SubTotal ?? datos.subtotal;
  if (datos.Descuento !== undefined || datos.descuento !== undefined) payload.Descuento = datos.Descuento ?? datos.descuento;
  if (datos.IVA !== undefined || datos.iva !== undefined) payload.IVA = datos.IVA ?? datos.iva;
  if (datos.MontoTotal !== undefined || datos.monto_total !== undefined) payload.MontoTotal = datos.MontoTotal ?? datos.monto_total;
  if (
    datos.MetodoPago !== undefined &&
    !isNaN(Number(datos.MetodoPago))
  ) {
    payload.MetodoPago = Number(datos.MetodoPago);
  }
  if (datos.UsuarioIdusuario !== undefined || datos.usuario_id !== undefined) payload.UsuarioIdusuario = datos.UsuarioIdusuario || datos.usuario_id;
  if (datos.cabana !== undefined) payload.cabana = datos.cabana;
  if (datos.paquete !== undefined) payload.paquete = datos.paquete;
  if (datos.paquetes_extra !== undefined) payload.paquetes_extra = datos.paquetes_extra;
  if (datos.servicios !== undefined) payload.servicios = datos.servicios;
  if (datos.notas !== undefined) payload.notas = datos.notas;
  if (datos.num_personas !== undefined) payload.num_personas = datos.num_personas;
  if (datos.Motivo !== undefined || datos.motivo !== undefined) payload.motivo = datos.Motivo || datos.motivo;
  if (datos.metodo_pago !== undefined) payload.metodo_pago = datos.metodo_pago;
  if (datos.comprobante_pago !== undefined) payload.comprobante_pago = datos.comprobante_pago;
  if (datos.monto_pagado !== undefined) payload.monto_pagado = datos.monto_pagado;

  const estadoValor = datos.estado || datos.Estado;
  if (estadoValor) {
    const estadoId = STATE_TO_ID[String(estadoValor).toLowerCase()];
    if (estadoId) payload.IdEstadoReserva = estadoId;
  }

  return payload;
};

const isEarlierThanToday = (value) => {
  const dateString = toDateString(value);
  if (!dateString) return false;
  const today = new Date();
  const todayString = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`;
  return dateString < todayString;
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

  const where = {
    IdEstadoReserva: { [Op.in]: [1, 2, 5] },
    [Op.and]: [fechaOverlap],
  };

  // Scope by cabin: blockages AND reservations must match the same cabin
  if (cabana) {
    where.cabana = cabana;
  }

  if (excluirId) where.IdReserva = { [Op.ne]: excluirId };
  const conflictos = await Reserva.findAll({ where });

  return { disponible: conflictos.length === 0, conflictos };
};

const calcularTotal = (subtotal, descuento = 0, iva = 0) => {
  const base = parseFloat(subtotal) || 0;
  const desc = parseFloat(descuento) || 0;
  const ivaAmount = parseFloat(iva) || 0;
  const neto = base - desc;
  return parseFloat((neto + ivaAmount).toFixed(2));
};

const verDisponibilidad = async () => {
  const registros = await Reserva.findAll({
    where: { IdEstadoReserva: { [Op.in]: [1, 2, 5] } },
    attributes: ['IdReserva', 'FechaInicio', 'FechaFinalizacion', 'IdEstadoReserva', 'cabana'],
  });

  const reservadas = registros
    .filter(r => [1, 2].includes(r.IdEstadoReserva))
    .flatMap(r => rangeDates(r.FechaInicio, r.FechaFinalizacion));

  const bloqueadas = registros
    .filter(r => r.IdEstadoReserva === 5)
    .flatMap(r => rangeDates(r.FechaInicio, r.FechaFinalizacion));

  // Also return raw records so the frontend can filter by cabin
  const registrosNorm = registros.map(r => ({
    id: r.IdReserva,
    fecha_inicio: toDateString(r.FechaInicio),
    fecha_fin: toDateString(r.FechaFinalizacion),
    estado: ESTADO_MAP[r.IdEstadoReserva] || 'pendiente',
    cabana: r.cabana,
  }));

  return { reservadas: [...new Set(reservadas)], bloqueadas: [...new Set(bloqueadas)], registros: registrosNorm };
};

const bloquearFechas = async (datos, usuarioId) => {
  const payload = parsePayload(datos);
  const { FechaInicio, FechaFinalizacion, motivo, cabana } = payload;
  const { disponible, conflictos } = await verificarDisponibilidad(FechaInicio, FechaFinalizacion, cabana);
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
    cabana: cabana || null
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

  if (isEarlierThanToday(FechaInicio)) {
    const error = new Error('La fecha de inicio debe ser a partir de hoy');
    error.status = 400;
    throw error;
  }

  const usuario = await Usuario.findByPk(usuarioId);
  if (!usuario) {
    const error = new Error('Usuario no encontrado');
    error.status = 404;
    throw error;
  }
  if (usuario.Estado === false || usuario.Estado === 0 || usuario.Estado === 'inactivo') {
    const error = new Error('No se puede crear la reserva: El usuario está inactivo');
    error.status = 403;
    throw error;
  }

  let idDuenoReserva = usuarioId; // Por defecto el que hace la petición (ej. Cliente)
  let clienteFinal = usuario;

  // Si quien crea la reserva es un administrador, debe asignarla a un cliente
  if (usuario.IDRol === 1) {
    if (!payload.NroDocumentoCliente) {
      const error = new Error('Los administradores deben proporcionar un documento, email o usuario de cliente válido para crear la reserva.');
      error.status = 400;
      throw error;
    }

    const docVal = String(payload.NroDocumentoCliente).trim();
    const whereOr = [
      { NumeroDocumento: docVal },
      { Email: docVal },
      { NombreUsuario: docVal }
    ];
    if (!isNaN(Number(docVal))) {
      whereOr.push({ IDUsuario: Number(docVal) });
    }

    const targetClient = await Usuario.findOne({
      where: {
        IDRol: 2,
        [Op.or]: whereOr
      }
    });

    if (!targetClient) {
      const error = new Error(`No se encontró ningún cliente con la identificación "${docVal}". La reserva no puede pertenecer a un administrador.`);
      error.status = 404;
      throw error;
    }

    if (targetClient.Estado === false || targetClient.Estado === 0 || targetClient.Estado === 'inactivo') {
      const error = new Error('No se puede crear la reserva: El cliente seleccionado está inactivo.');
      error.status = 403;
      throw error;
    }

    // Asignar la reserva al cliente encontrado
    idDuenoReserva = targetClient.IDUsuario;
    clienteFinal = targetClient;
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
  
  // Si no es por Stripe, o si viene estado confirmado explícitamente, marcar como confirmada.
  // 1 = Stripe, 2 = Transferencia, 3 = Efectivo. Si es transferencia o efectivo -> 2 (Confirmada)
  payload.IdEstadoReserva = (payload.MetodoPago !== 1 && payload.MetodoPago !== 'stripe') ? 2 : 1;
  
  payload.UsuarioIdusuario = idDuenoReserva;

  const reserva = await Reserva.create(payload);
  const reservaNormalizada = normalizeReserva(reserva);

  return reservaNormalizada;
};

const listarReservas = async (filtros = {}, paginacion = {}) => {
  const estadoId = ({ pendiente: 1, confirmada: 2, cancelada: 3, completada: 4, bloqueada: 5 })[filtros.estado];
  const where = { IdEstadoReserva: { [Op.ne]: 5 } };

  if (estadoId) where.IdEstadoReserva = estadoId;
  if (filtros.documento) where.NroDocumentoCliente = { [Op.like]: `%${filtros.documento}%` };
  if (filtros.fechaDesde) where.FechaInicio = { [Op.gte]: filtros.fechaDesde };
  if (filtros.fechaHasta) where.FechaFinalizacion = { [Op.lte]: filtros.fechaHasta };

  if (filtros.q) {
    const q = filtros.q.trim().replace(/^#/, ''); // quitar # si lo escriben
    const orConditions = [
      { NroDocumentoCliente: { [Op.like]: `%${q}%` } },
      { '$usuario.NombreUsuario$': { [Op.like]: `%${q}%` } },
      { '$usuario.Apellido$': { [Op.like]: `%${q}%` } }
    ];
    // Si es numérico, buscar también por ID exacto
    if (/^\d+$/.test(q)) {
      orConditions.unshift({ IdReserva: parseInt(q, 10) });
    }
    where[Op.or] = orConditions;
  }

  // Obtener total de registros para paginación
  const countOpts = { where };
  if (filtros.q) countOpts.include = [{ model: Usuario, as: 'usuario' }];
  const total = await Reserva.count(countOpts);

  // Aplicar paginación
  const { limit = 5, offset = 0 } = paginacion;
  const reservas = await Reserva.findAll({
    where,
    include: [{ model: Usuario, as: 'usuario' }],
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
  const reservas = await Reserva.findAll({
    where,
    include: [{ model: Usuario, as: 'usuario' }],
    order: [['FechaReserva', 'DESC']]
  });
  return reservas.map(normalizeReserva);
};

const obtenerReserva = async (id) => {
  const reserva = await Reserva.findByPk(id, {
    include: [{ model: Usuario, as: 'usuario' }]
  });
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

  const oldEstadoId = reserva.IdEstadoReserva;

  const payload = parsePayload(datos);

  // Verificar si el cliente asociado está inactivo
  if (payload.NroDocumentoCliente) {
    const docNum = Number(payload.NroDocumentoCliente);
    const whereCond = { IDRol: 2 };
    if (!isNaN(docNum)) {
      whereCond[Op.or] = [
        { NumeroDocumento: docNum },
        { IDUsuario: docNum }
      ];
    } else {
      whereCond[Op.or] = [
        { NumeroDocumento: -1 },
        { IDUsuario: -1 }
      ];
    }
    const targetClient = await Usuario.findOne({ where: whereCond });
    if (targetClient && (targetClient.Estado === false || targetClient.Estado === 0 || targetClient.Estado === 'inactivo')) {
      const error = new Error('No se puede actualizar la reserva: El cliente seleccionado está inactivo');
      error.status = 403;
      throw error;
    }
  }
  if (payload.FechaInicio || payload.FechaFinalizacion || payload.cabana) {
    const inicio = payload.FechaInicio || reserva.FechaInicio;
    const fin = payload.FechaFinalizacion || reserva.FechaFinalizacion;
    const cabana = payload.cabana || reserva.cabana;

    if (payload.FechaInicio && isEarlierThanToday(payload.FechaInicio)) {
      const error = new Error('La fecha de inicio debe ser a partir de hoy');
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

  if (datos.total_nuevos_servicios !== undefined) {
    const extra = Number(datos.total_nuevos_servicios) || 0;
    payload.SubTotal = (payload.SubTotal ?? reserva.SubTotal ?? 0) + extra;
    payload.MontoTotal = calcularTotal(
      payload.SubTotal,
      payload.Descuento ?? reserva.Descuento,
      payload.IVA ?? reserva.IVA,
    );
  } else if (payload.SubTotal !== undefined || payload.Descuento !== undefined || payload.IVA !== undefined) {
    payload.MontoTotal = calcularTotal(
      payload.SubTotal ?? reserva.SubTotal,
      payload.Descuento ?? reserva.Descuento,
      payload.IVA ?? reserva.IVA,
    );

    if (payload.monto_pagado === undefined) {
      payload.monto_pagado = payload.MontoTotal;
    }
  }

  await reserva.update(payload);
  const reservaNormalizada = normalizeReserva(reserva);

  if (payload.IdEstadoReserva && payload.IdEstadoReserva !== oldEstadoId) {
    try {
      const targetClient = await Usuario.findByPk(reserva.UsuarioIdusuario);
      if (targetClient && targetClient.Email) {
        emailService.enviarCambioEstadoReserva({
          to: targetClient.Email,
          nombre: targetClient.NombreUsuario,
          reserva: reservaNormalizada,
          nuevoEstado: ESTADO_MAP[payload.IdEstadoReserva] || 'desconocido'
        }).catch(err => console.error('Error enviando email de cambio de estado:', err.message));
      }
    } catch (err) {
      console.error('Error al intentar enviar email de cambio de estado:', err.message);
    }
  }

  // Notificación de nuevos servicios agregados
  if (datos.nuevos_servicios_detalle && datos.nuevos_servicios_detalle.length > 0 && datos.metodo_pago_nuevos_servicios) {
    try {
      const targetClient = await Usuario.findByPk(reserva.UsuarioIdusuario);
      if (targetClient && targetClient.Email) {
        // En caso de transferencia, opcionalmente podrías guardar los datos de `datos.datos_transferencia` en la BD
        // Por ahora enviamos el correo
        emailService.enviarNotificacionNuevoServicio({
          to: targetClient.Email,
          nombre: targetClient.NombreUsuario,
          reserva: reservaNormalizada,
          nuevosServiciosDetalle: datos.nuevos_servicios_detalle,
          totalNuevos: datos.total_nuevos_servicios,
          metodoPagoNuevos: datos.metodo_pago_nuevos_servicios
        }).catch(err => console.error('Error enviando email de nuevos servicios:', err.message));
      }
    } catch (err) {
      console.error('Error al intentar enviar email de nuevos servicios:', err.message);
    }
  }

  return reservaNormalizada;
};

const eliminarReserva = async (id, motivoStr = 'Sin motivo', canceladoPor = 'Desconocido') => {
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

  // Validación de 24 horas
  const checkIn = parseDateOnly(reserva.FechaInicio);
  // Ajustar el checkin a las 13:00 hora local (asumiendo Colombia UTC-5) = 18:00 UTC
  checkIn.setUTCHours(18, 0, 0, 0);
  const ahora = new Date();
  const diffHours = (checkIn.getTime() - ahora.getTime()) / (1000 * 60 * 60);

  if (diffHours < 24) {
    const error = new Error('No puedes cancelar la reserva porque faltan menos de 24 horas para el check-in.');
    error.status = 400;
    throw error;
  }

  const motivoCompleto = `${canceladoPor}: ${motivoStr}`;
  await reserva.update({ IdEstadoReserva: 3, motivo: motivoCompleto });

  try {
    const targetClient = await Usuario.findByPk(reserva.UsuarioIdusuario);
    if (targetClient && targetClient.Email) {
      emailService.enviarCambioEstadoReserva({
        to: targetClient.Email,
        nombre: targetClient.NombreUsuario,
        reserva: normalizeReserva(reserva),
        nuevoEstado: 'cancelada'
      }).catch(err => console.error('Error enviando email de cancelación:', err.message));
    }
  } catch (err) {
    console.error('Error al intentar enviar email de cancelación:', err.message);
  }

  return { mensaje: 'Reserva cancelada correctamente' };
};

const limpiarReservasPendientes = async () => {
  try {
    const quinceMinutosAtras = new Date(Date.now() - 15 * 60 * 1000);
    const eliminadas = await Reserva.destroy({
      where: {
        IdEstadoReserva: 1, // Pendiente
        FechaReserva: { [Op.lt]: quinceMinutosAtras }
      }
    });
    if (eliminadas > 0) {
      console.log(`[Limpieza Automática] Eliminadas ${eliminadas} reservas pendientes (no pagadas) creadas hace más de 15 min.`);
    }
  } catch (error) {
    console.error('[Limpieza Automática] Error limpiando reservas pendientes:', error.message);
  }
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
  limpiarReservasPendientes,
};
