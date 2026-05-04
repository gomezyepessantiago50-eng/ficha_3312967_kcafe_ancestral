const { sequelize, connectDB } = require('./connection');
const { QueryTypes } = require('sequelize');

const seedData = async () => {
  await connectDB();
  console.log('--- Iniciando Seeding de Módulos ---');
  
  try {
    // 1. Habitaciones
    console.log('Insertando Habitaciones...');
    await sequelize.query(
      `INSERT IGNORE INTO habitacion (IDHabitacion, NombreHabitacion, Descripcion, Costo, Estado) VALUES
       (1, 'El Roble', 'Cabaña familiar de dos pisos', 280000, 1),
       (2, 'La Ceiba', 'Ideal para parejas', 420000, 1),
       (3, 'Ancestral', 'Lujo y comodidad', 650000, 1)`,
      { type: QueryTypes.INSERT }
    );

    // 2. Servicios
    console.log('Insertando Servicios...');
    await sequelize.query(
      `INSERT IGNORE INTO servicios (IDServicio, NombreServicio, Descripcion, CantidadMaximaPersonas, Costo, Estado) VALUES
       (1, 'Spa', 'Masaje relajante de 1 hora', 2, 90000, 1),
       (2, 'Fogata', 'Fogata privada con malvaviscos', 6, 45000, 1),
       (3, 'Transporte', 'Recogida aeropuerto', 4, 60000, 1),
       (4, 'Fotografía', 'Sesión fotográfica 2h', 10, 120000, 1)`,
      { type: QueryTypes.INSERT }
    );

    // 3. Paquetes
    console.log('Insertando Paquetes...');
    await sequelize.query(
      `INSERT IGNORE INTO paquetes (IDPaquete, NombrePaquete, Descripcion, Precio, Estado, IDServicio) VALUES
       (1, 'Básico', 'Solo alojamiento, sin servicios adicionales', 0, 1, NULL),
       (2, 'Cafetero', 'Tour por cultivos + desayuno típico', 80000, 1, NULL),
       (3, 'Premium', 'Todo incluido (Spa y fogata)', 200000, 1, 1)`,
      { type: QueryTypes.INSERT }
    );

    console.log('--- Seeding Terminado Correctamente ---');
  } catch (error) {
    console.error('Error durante el seeding:', error.message);
  } finally {
    await sequelize.close();
  }
};

seedData();
