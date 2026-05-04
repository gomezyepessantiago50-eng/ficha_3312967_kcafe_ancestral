const dashboardService = require('../services/dashboardService');

const getDashboardData = async (req, res, next) => {
  try {
    const stats = await dashboardService.getDashboardStats();
    return res.status(200).json({ success: true, data: stats });
  } catch (error) { next(error); }
};

module.exports = { getDashboardData };
