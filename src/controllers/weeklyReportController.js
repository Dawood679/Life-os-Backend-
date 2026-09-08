const weeklyReportService = require('../services/weeklyReportService');

/**
 * GET /api/weekly-report
 * Get aggregated 7-day stats and existing/fresh weekly report
 */
const getWeeklyReport = async (req, res) => {
  try {
    const userId = req.user._id;
    const userTimezone = req.query.timezone || req.user.timezone || 'Asia/Dhaka';

    const result = await weeklyReportService.generateWeeklyReport(userId, userTimezone);

    return res.status(200).json({
      success: true,
      message: 'Weekly Life Report generated successfully',
      data: result
    });
  } catch (error) {
    console.error('Weekly Report Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate weekly life report',
      error: error.message
    });
  }
};

/**
 * GET /api/weekly-report/stats
 * Quick fetch 7-day stats only (without calling AI model)
 */
const getWeeklyStatsOnly = async (req, res) => {
  try {
    const userId = req.user._id;
    const userTimezone = req.query.timezone || req.user.timezone || 'Asia/Dhaka';

    const stats = await weeklyReportService.aggregate7DayStats(userId, userTimezone);

    return res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Weekly Stats Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch weekly stats',
      error: error.message
    });
  }
};

module.exports = {
  getWeeklyReport,
  getWeeklyStatsOnly
};
