const { sequelize } = require('../database/connection');
const { QueryTypes } = require('sequelize');

const getDashboardStats = async (range = 'todo') => {
  let dateFilter = '';
  if (range === 'hoy') dateFilter = 'AND DATE(FechaReserva) = CURDATE()';
  else if (range === 'semana') dateFilter = 'AND FechaReserva >= DATE_SUB(CURDATE(), INTERVAL 1 WEEK)';
  else if (range === 'mes') dateFilter = 'AND FechaReserva >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)';
  else if (range === '3meses') dateFilter = 'AND FechaReserva >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)';
  // 1. Total Sales (MontoTotal from Reserva)
  const [salesResult] = await sequelize.query(
    `SELECT SUM(MontoTotal) as totalSales FROM reserva WHERE IdEstadoReserva NOT IN (3, 5) ${dateFilter}`,
    { type: QueryTypes.SELECT }
  );

  // 2. Count of reservations
  const [reservationsCount] = await sequelize.query(
    `SELECT COUNT(*) as totalReservations FROM reserva WHERE IdEstadoReserva NOT IN (3, 5) ${dateFilter}`,
    { type: QueryTypes.SELECT }
  );

  // 3. Top Cabins
  const topCabins = await sequelize.query(
    `SELECT cabana as name, COUNT(*) as value 
     FROM reserva 
     WHERE cabana IS NOT NULL AND cabana != '' AND IdEstadoReserva NOT IN (3, 5) ${dateFilter}
     GROUP BY cabana 
     ORDER BY value DESC 
     LIMIT 5`,
    { type: QueryTypes.SELECT }
  );

  // 4. Top Packages
  const topPackages = await sequelize.query(
    `SELECT paquete as name, COUNT(*) as value 
     FROM reserva 
     WHERE paquete IS NOT NULL AND paquete != '' AND IdEstadoReserva NOT IN (3, 5) ${dateFilter}
     GROUP BY paquete 
     ORDER BY value DESC 
     LIMIT 5`,
    { type: QueryTypes.SELECT }
  );

  // 5. Reservations by Month (last 6 months - ignore range filter to always show chart context)
  const reservationsByMonth = await sequelize.query(
    `SELECT DATE_FORMAT(FechaReserva, '%Y-%m') as month, COUNT(*) as count, SUM(MontoTotal) as revenue
     FROM reserva 
     WHERE IdEstadoReserva NOT IN (3, 5)
     GROUP BY month 
     ORDER BY month ASC 
     LIMIT 12`,
    { type: QueryTypes.SELECT }
  );

  // 6. Top Services (Aggregated in memory due to JSON storage)
  const servicesData = await sequelize.query(
    `SELECT servicios FROM reserva WHERE servicios IS NOT NULL AND servicios != '[]' AND IdEstadoReserva NOT IN (3, 5) ${dateFilter}`,
    { type: QueryTypes.SELECT }
  );
  const srvCounts = {};
  servicesData.forEach(row => {
    try {
      const srvs = typeof row.servicios === 'string' ? JSON.parse(row.servicios) : row.servicios;
      if (Array.isArray(srvs)) {
        srvs.forEach(s => {
          const key = typeof s === 'string' ? s : (s && s.id ? s.id : null);
          if (key) {
            const cant = (typeof s === 'object' && s.cantidad) ? s.cantidad : 1;
            srvCounts[key] = (srvCounts[key] || 0) + cant;
          }
        });
      }
    } catch(e) {}
  });
  const topServices = Object.entries(srvCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  return {
    totalSales: salesResult.totalSales || 0,
    totalReservations: reservationsCount.totalReservations || 0,
    topCabins,
    topPackages,
    topServices,
    reservationsByMonth,
  };
};

module.exports = { getDashboardStats };
