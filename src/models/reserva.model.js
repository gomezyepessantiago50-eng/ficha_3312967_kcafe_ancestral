// models/reserva.model.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const Reserva = sequelize.define('Reserva', {
  IdReserva: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  NroDocumentoCliente: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  FechaReserva: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  FechaInicio: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  FechaFinalizacion: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  SubTotal: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0,
  },
  Descuento: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  IVA: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  MontoTotal: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0,
  },
  MetodoPago: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 1,
  },
  IdEstadoReserva: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 1, // 1 = Pendiente
  },
  UsuarioIdusuario: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  cabana: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  paquete: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  servicios: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  notas: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  num_personas: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  motivo: {
    type: DataTypes.STRING(200),
    allowNull: true,
  },
  metodo_pago: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  comprobante_pago: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  monto_pagado: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
}, {
  tableName: 'Reserva',
  timestamps: false,
});

module.exports = Reserva;