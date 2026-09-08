const dailyBriefingService = require('../services/dailyBriefingService');

/**
 * GET /api/daily-briefing/today
 * Retrieves today's cached briefing (or generates if cache miss) based on user's timezone
 */
exports.getTodayBriefing = async (req, res) => {
  try {
    const userId = req.user._id;
    const clientTimezone = req.headers['x-user-timezone'] || req.query.timezone || null;

    const briefing = await dailyBriefingService.getOrCreateDailyBriefing(
      userId,
      clientTimezone,
      false
    );

    return res.status(200).json({
      success: true,
      data: briefing
    });
  } catch (error) {
    console.error('[dailyBriefingController:getTodayBriefing] Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to retrieve daily briefing.'
    });
  }
};

/**
 * POST /api/daily-briefing/regenerate
 * Forces a fresh re-evaluation of context and narrative for the current period
 */
exports.regenerateBriefing = async (req, res) => {
  try {
    const userId = req.user._id;
    const clientTimezone = req.headers['x-user-timezone'] || req.body.timezone || null;

    const briefing = await dailyBriefingService.getOrCreateDailyBriefing(
      userId,
      clientTimezone,
      true
    );

    return res.status(200).json({
      success: true,
      message: 'Daily briefing refreshed with latest context.',
      data: briefing
    });
  } catch (error) {
    console.error('[dailyBriefingController:regenerateBriefing] Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to regenerate daily briefing.'
    });
  }
};
