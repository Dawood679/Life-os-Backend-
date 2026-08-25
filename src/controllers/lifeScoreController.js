const lifeScoreService = require('../services/lifeScoreService');
const skillService = require('../services/skillService');
const User = require('../models/User');

/**
 * @desc Get today's Life Score, breakdown, what-if deltas, and streak
 * @route GET /api/life-score/today
 * @access Private
 */
exports.getTodayScore = async (req, res) => {
  try {
    const targetDate = req.query.date || null;
    const scoreData = await lifeScoreService.calculateDailyScore(req.user._id, targetDate);

    res.status(200).json({
      success: true,
      data: scoreData
    });
  } catch (error) {
    console.error('Error fetching today Life Score:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to calculate Life Score'
    });
  }
};

/**
 * @desc Get historical Life Score logs (e.g. last 7 or 30 days)
 * @route GET /api/life-score/history
 * @access Private
 */
exports.getScoreHistory = async (req, res) => {
  try {
    const days = parseInt(req.query.days, 10) || 7;
    const history = await lifeScoreService.getLifeScoreHistory(req.user._id, Math.min(60, days));

    res.status(200).json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Error fetching Life Score history:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to retrieve score history'
    });
  }
};

/**
 * @desc Update User Focus Mode & Weights
 * @route PATCH /api/life-score/focus-mode
 * @access Private
 */
exports.updateFocusMode = async (req, res) => {
  try {
    const { focusMode, focusWeights, focusGoal } = req.body;

    const allowedModes = ['balanced', 'career_sprint', 'student_exam', 'custom'];
    if (focusMode && !allowedModes.includes(focusMode)) {
      return res.status(400).json({
        success: false,
        message: `Invalid focusMode. Allowed: ${allowedModes.join(', ')}`
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (focusMode) user.focusMode = focusMode;
    if (focusGoal !== undefined) user.focusGoal = focusGoal;

    if (focusMode === 'custom' && focusWeights) {
      user.focusWeights = {
        health: Number(focusWeights.health) || 0.35,
        learning: Number(focusWeights.learning) || 0.40,
        career: Number(focusWeights.career) || 0.25
      };
    } else if (focusMode === 'career_sprint') {
      user.focusWeights = { health: 0.20, learning: 0.30, career: 0.50 };
    } else if (focusMode === 'student_exam') {
      user.focusWeights = { health: 0.30, learning: 0.50, career: 0.20 };
    } else if (focusMode === 'balanced') {
      user.focusWeights = { health: 0.35, learning: 0.40, career: 0.25 };
    }

    await user.save();

    // Recalculate today's score with new settings
    const updatedScore = await lifeScoreService.calculateDailyScore(user._id);

    res.status(200).json({
      success: true,
      message: 'Focus mode updated successfully',
      data: updatedScore
    });
  } catch (error) {
    console.error('Error updating focus mode:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update focus mode'
    });
  }
};

/**
 * @desc Get User's Cross-Module Verified Skills
 * @route GET /api/life-score/verified-skills
 * @access Private
 */
exports.getVerifiedSkills = async (req, res) => {
  try {
    const skills = await skillService.getVerifiedSkills(req.user._id);
    res.status(200).json({
      success: true,
      data: skills
    });
  } catch (error) {
    console.error('Error fetching verified skills:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to retrieve verified skills'
    });
  }
};
