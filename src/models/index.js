'use strict';

const fs        = require('fs');
const path      = require('path');
const Sequelize = require('sequelize');
const { sequelize } = require('../database/connection');

const db = {};

// Carga automática de todos los modelos en esta carpeta
fs.readdirSync(__dirname)
  .filter((file) => file !== 'index.js' && file.endsWith('.js'))
  .forEach((file) => {
    const imported = require(path.join(__dirname, file));
    let model;
    try {
      // Intentar como factory function: (sequelize) => ...
      model = imported(sequelize, Sequelize.DataTypes);
    } catch (err) {
      // Si da error de 'Class constructor', significa que el archivo ya exportaba el modelo instanciado
      if (err.message && err.message.includes("Class constructor")) {
        model = imported;
      } else {
        throw err;
      }
    }
    if (model && model.name) {
      db[model.name] = model;
    }
  });

// Ejecuta las asociaciones una vez que todos los modelos están cargados
Object.values(db).forEach((model) => {
  if (typeof model.associate === 'function') {
    model.associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
