'use strict';

const fs        = require('fs');
const path      = require('path');
const Sequelize = require('sequelize');
const sequelize = require('../database/connection');

const db = {};

// Carga automática de todos los modelos en esta carpeta
fs.readdirSync(__dirname)
  .filter((file) => file !== 'index.js' && file.endsWith('.js'))
  .forEach((file) => {
    const model = require(path.join(__dirname, file))(sequelize);
    db[model.name] = model;
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
