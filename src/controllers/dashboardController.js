const dashboardService = require('../services/dashboardService');

const getDashboardData = async (req, res, next) => {
  try {
    const range = req.query.range || 'todo';
    const stats = await dashboardService.getDashboardStats(range);
    return res.status(200).json({ success: true, data: stats });
  } catch (error) { next(error); }
};

module.exports = { getDashboardData };
