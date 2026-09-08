const reschedulerService = require('../services/smartReschedulerService');

/**
 * GET /api/rescheduler/proposal
 * Returns deficit analysis and proposed task breakdown (read-only)
 */
const getProposal = async (req, res) => {
  try {
    const userTimezone = req.headers['x-user-timezone'] || req.user.timezone || 'Asia/Dhaka';
    const proposal = await reschedulerService.getProposalDetails(req.user._id, userTimezone);

    res.json({
      success: true,
      data: proposal
    });
  } catch (error) {
    console.error('Get rescheduler proposal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to evaluate health-aware schedule proposal.'
    });
  }
};

/**
 * POST /api/rescheduler/apply
 * Applies user-approved batch deferral for non-urgent tasks
 */
const applyRecovery = async (req, res) => {
  try {
    const userTimezone = req.headers['x-user-timezone'] || req.user.timezone || 'Asia/Dhaka';
    const result = await reschedulerService.executeRecovery(req.user._id, userTimezone);

    res.json({
      success: true,
      message: `Recovery mode active! Deferred ${result.deferredCount} tasks to tomorrow.`,
      data: result
    });
  } catch (error) {
    console.error('Apply recovery error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to apply recovery rescheduling.'
    });
  }
};

/**
 * POST /api/rescheduler/undo
 * Restores deferred tasks back to original due date
 */
const undoRecovery = async (req, res) => {
  try {
    const userTimezone = req.headers['x-user-timezone'] || req.user.timezone || 'Asia/Dhaka';
    const result = await reschedulerService.undoRecovery(req.user._id, userTimezone);

    res.json({
      success: true,
      message: `Restored ${result.restoredCount} tasks back to today.`,
      data: result
    });
  } catch (error) {
    console.error('Undo recovery error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to undo recovery rescheduling.'
    });
  }
};

module.exports = {
  getProposal,
  applyRecovery,
  undoRecovery
};
