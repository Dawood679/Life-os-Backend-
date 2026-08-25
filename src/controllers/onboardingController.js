const User = require('../models/User');
const { ai, onboardingConfig } = require('../config/gemini');
const { callAIWithFallback } = require('../utils/aiWithFallback');
const lifeScoreService = require('../services/lifeScoreService');

/**
 * @desc Analyze user free-text monthly goal and auto-configure OS dashboard
 * @route POST /api/onboarding/analyze-goal
 * @access Private
 */
exports.analyzeGoal = async (req, res) => {
  try {
    const { goal } = req.body;
    const userGoal = (goal || "").trim();

    if (!userGoal) {
      return res.status(400).json({
        success: false,
        message: 'Please provide your main goal or focus for this month'
      });
    }

    const prompt = `
      User monthly goal intake: "${userGoal}"

      Analyze the user's intent.
      If specific: determine exact primaryDomain ("tech" | "business" | "academic" | "wellness" | "general"), recommendedFocusMode ("career_sprint" | "student_exam" | "balanced"), and 4-5 recommended widget IDs.
      If ambiguous or vague (e.g. "get better at life", "make money", "help me"): set isAmbiguous: true and provide exactly 3 crystal-clear clarifying focus cards.
      Respond strictly in JSON matching the schema.
    `;

    const response = await callAIWithFallback(ai, onboardingConfig, prompt);
    const cleanText = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanText);

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // If specific, automatically apply to user profile
    if (!parsed.isAmbiguous) {
      user.focusGoal = parsed.detectedIntent || userGoal;
      user.primaryDomain = parsed.primaryDomain || 'general';
      user.focusMode = parsed.recommendedFocusMode || 'balanced';

      if (Array.isArray(parsed.recommendedWidgets) && parsed.recommendedWidgets.length > 0) {
        user.dashboardWidgets = parsed.recommendedWidgets;
      }

      await user.save();

      // Recalculate daily Life Score with new focus weights
      try {
        await lifeScoreService.calculateDailyScore(user._id);
      } catch (scoreErr) {
        console.error('Life score update warning:', scoreErr);
      }
    }

    res.status(200).json({
      success: true,
      isAmbiguous: !!parsed.isAmbiguous,
      data: parsed,
      user: {
        focusGoal: user.focusGoal,
        primaryDomain: user.primaryDomain,
        focusMode: user.focusMode,
        dashboardWidgets: user.dashboardWidgets
      }
    });
  } catch (error) {
    console.error('Onboarding analysis error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error analyzing goal'
    });
  }
};

/**
 * @desc Explicitly apply a selected focus mode and widget set (e.g. from clarifying cards)
 * @route POST /api/onboarding/select-focus
 * @access Private
 */
exports.selectFocus = async (req, res) => {
  try {
    const { focusMode, primaryDomain, focusGoal, widgets } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (focusMode) user.focusMode = focusMode;
    if (primaryDomain) user.primaryDomain = primaryDomain;
    if (focusGoal) user.focusGoal = focusGoal;
    if (Array.isArray(widgets) && widgets.length > 0) {
      user.dashboardWidgets = widgets;
    }

    await user.save();

    // Recalculate daily Life Score
    try {
      await lifeScoreService.calculateDailyScore(user._id);
    } catch (scoreErr) {
      console.error('Life score update warning:', scoreErr);
    }

    res.status(200).json({
      success: true,
      message: 'Focus configuration applied successfully',
      user: {
        focusGoal: user.focusGoal,
        primaryDomain: user.primaryDomain,
        focusMode: user.focusMode,
        dashboardWidgets: user.dashboardWidgets
      }
    });
  } catch (error) {
    console.error('Select focus error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error applying focus'
    });
  }
};
