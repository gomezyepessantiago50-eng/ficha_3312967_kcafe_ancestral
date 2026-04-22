// src/models/usuario.model.js
'use strict';

const { DataTypes } = require('sequelize');
const { sequelize }  = require('../database/connection');

const Usuario = sequelize.define('Usuario', {
  IDUsuario: {
    type:          DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey:    true,
  },
  NombreUsuario: {
    type:      DataTypes.STRING(255),
    allowNull: false,
  },
  Apellido: {
    type:      DataTypes.STRING(255),
    allowNull: true,
  },
  Email: {
    type:      DataTypes.STRING(255),
    allowNull: false,
    unique:    true,
    validate:  { isEmail: true },
  },
  Contrasena: {
    type:      DataTypes.STRING(255),
    allowNull: false,
  },
  TipoDocumento: {
    type:      DataTypes.STRING(50),
    allowNull: true,
  },
  NumeroDocumento: {
    type:      DataTypes.INTEGER,
    allowNull: true,
  },
  Telefono: {
    type:      DataTypes.STRING(50),
    allowNull: true,
  },
  Pais: {
    type:      DataTypes.STRING(100),
    allowNull: true,
  },
  Direccion: {
    type:      DataTypes.STRING(255),
    allowNull: true,
  },
  IDRol: {
    type:       DataTypes.INTEGER,
    allowNull:  true,
    references: { model: 'Roles', key: 'IDRol' },
  },
  // Token para recuperación de contraseña
  ResetToken: {
    type:      DataTypes.STRING(255),
    allowNull: true,
  },
  ResetTokenExpira: {
    type:      DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName:  'Usuarios',
  timestamps: false,
});

module.exports = Usuario;
