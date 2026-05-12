const { sequelize } = require('../database/connection');
const { QueryTypes } = require('sequelize');

const getDashboardStats = async () => {
  // 1. Total Sales (MontoTotal from Reserva)
  const [salesResult] = await sequelize.query(
    'SELECT SUM(MontoTotal) as totalSales FROM Reserva WHERE IdEstadoReserva NOT IN (3, 5)',
    { type: QueryTypes.SELECT }
  );

  // 2. Count of reservations
  const [reservationsCount] = await sequelize.query(
    'SELECT COUNT(*) as totalReservations FROM Reserva WHERE IdEstadoReserva NOT IN (3, 5)',
    { type: QueryTypes.SELECT }
  );

  // 3. Top Cabins
  const topCabins = await sequelize.query(
    `SELECT cabana as name, COUNT(*) as value 
     FROM Reserva 
     WHERE cabana IS NOT NULL AND cabana != ''
     GROUP BY cabana 
     ORDER BY value DESC 
     LIMIT 5`,
    { type: QueryTypes.SELECT }
  );

  // 4. Top Packages
  const topPackages = await sequelize.query(
    `SELECT paquete as name, COUNT(*) as value 
     FROM Reserva 
     WHERE paquete IS NOT NULL AND paquete != ''
     GROUP BY paquete 
     ORDER BY value DESC 
     LIMIT 5`,
    { type: QueryTypes.SELECT }
  );

  // 5. Reservations by Month (last 6 months)
  const reservationsByMonth = await sequelize.query(
    `SELECT DATE_FORMAT(FechaReserva, '%Y-%m') as month, COUNT(*) as count 
     FROM Reserva 
     GROUP BY month 
     ORDER BY month ASC 
     LIMIT 12`,
    { type: QueryTypes.SELECT }
  );

  return {
    totalSales: salesResult.totalSales || 0,
    totalReservations: reservationsCount.totalReservations || 0,
    topCabins,
    topPackages,
    reservationsByMonth,
  };
};

module.exports = { getDashboardStats };
