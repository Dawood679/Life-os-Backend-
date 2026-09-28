const User = require('../models/User');
const JobApplication = require('../models/JobApplication');

// Check if a user has active PRO or Lifetime privileges
const isUserPro = (user) => {
  if (!user) return false;
  const isSubActive = user.subscription?.status === 'active';
  const isProPlan = ['pro', 'pro_monthly', 'pro_yearly', 'lifetime'].includes(user.subscription?.plan);
  return isSubActive && isProPlan;
};

// Auto-reset expired quotas for free users
const checkAndResetQuotas = async (user) => {
  if (!user.usageQuota) {
    user.usageQuota = {
      mockInterviewsUsed: 0,
      studyPlansThisWeek: 0,
      roadmapsGenerated: 0,
      quotaResetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      weeklyResetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    };
    await user.save();
    return;
  }

  let modified = false;
  const now = new Date();

  // Monthly reset
  if (user.usageQuota.quotaResetDate && now > new Date(user.usageQuota.quotaResetDate)) {
    user.usageQuota.mockInterviewsUsed = 0;
    user.usageQuota.roadmapsGenerated = 0;
    user.usageQuota.quotaResetDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    modified = true;
  }

  // Weekly reset
  if (user.usageQuota.weeklyResetDate && now > new Date(user.usageQuota.weeklyResetDate)) {
    user.usageQuota.studyPlansThisWeek = 0;
    user.usageQuota.weeklyResetDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    modified = true;
  }

  if (modified) {
    await user.save();
  }
};

/**
 * Express middleware to enforce Freemium quotas and feature locks
 * @param {string} feature - 'mock_interview' | 'study_plan' | 'roadmap' | 'smart_rescheduler' | 'job_applications'
 */
const requireFeatureQuota = (feature) => async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    // 1. Pro users have unlimited access to everything
    if (isUserPro(user)) {
      return next();
    }

    // 2. Ensure quotas are up to date
    await checkAndResetQuotas(user);

    // 3. Evaluate specific feature limits for Free / Starter users
    switch (feature) {
      case 'mock_interview':
        if ((user.usageQuota?.mockInterviewsUsed || 0) >= 1) {
          return res.status(403).json({
            success: false,
            code: 'QUOTA_EXCEEDED',
            feature: 'mock_interview',
            message: 'You have used your 1 free AI Mock Interview for this month.',
            upgradeTitle: 'Unlock Unlimited AI Mock Interviews',
            upgradeDescription: 'Practice with unlimited audio/text turns, get comprehensive radar diagnostics, and benchmark answers with Pro.'
          });
        }
        break;

      case 'study_plan':
        if ((user.usageQuota?.studyPlansThisWeek || 0) >= 5) {
          return res.status(403).json({
            success: false,
            code: 'QUOTA_EXCEEDED',
            feature: 'study_plan',
            message: 'You have reached your free allowance of 5 AI Study Plans this week.',
            upgradeTitle: 'Master Any Subject Without Limits',
            upgradeDescription: 'Generate unlimited outcome-driven study plans, micro-quizzes, and earn official Verified Skill Badges with Pro.'
          });
        }
        break;

      case 'roadmap':
        if ((user.usageQuota?.roadmapsGenerated || 0) >= 1) {
          return res.status(403).json({
            success: false,
            code: 'QUOTA_EXCEEDED',
            feature: 'roadmap',
            message: 'You have already generated 1 active 90-Day Career Roadmap on the Free plan.',
            upgradeTitle: 'Unlock Multi-Goal Roadmaps & Phase 2/3',
            upgradeDescription: 'Generate multi-track career roadmaps and unlock all 3 phases with 1-click agenda scheduling with Pro.'
          });
        }
        break;

      case 'smart_rescheduler':
        return res.status(403).json({
          success: false,
          code: 'FEATURE_LOCKED',
          feature: 'smart_rescheduler',
          message: 'The AI Smart Rescheduler & Human EA Burnout Guard is a Pro feature.',
          upgradeTitle: 'Activate Your AI Human Executive Assistant',
          upgradeDescription: 'Get automatic health deficit detection, 1-click batch snooze to protect daily streaks, and intelligent recovery with Pro.'
        });

      case 'job_applications': {
        const count = await JobApplication.countDocuments({ user: user._id });
        if (count >= 10) {
          return res.status(403).json({
            success: false,
            code: 'QUOTA_EXCEEDED',
            feature: 'job_applications',
            message: 'You have reached the free limit of 10 active job applications.',
            upgradeTitle: 'Supercharge Your Job Search Pipeline',
            upgradeDescription: 'Track unlimited job applications, unlock 16-column Excel spreadsheets, and auto-generate custom interview prep with Pro.'
          });
        }
        break;
      }

      default:
        break;
    }

    next();
  } catch (error) {
    console.error('Error in planLimiter middleware:', error);
    next(error);
  }
};

/**
 * Increment feature usage for a user after successful AI operation
 */
const incrementFeatureUsage = async (userId, feature) => {
  try {
    const user = await User.findById(userId);
    if (!user || isUserPro(user)) return;

    if (!user.usageQuota) {
      user.usageQuota = {
        mockInterviewsUsed: 0,
        studyPlansThisWeek: 0,
        roadmapsGenerated: 0
      };
    }

    if (feature === 'mock_interview') {
      user.usageQuota.mockInterviewsUsed = (user.usageQuota.mockInterviewsUsed || 0) + 1;
    } else if (feature === 'study_plan') {
      user.usageQuota.studyPlansThisWeek = (user.usageQuota.studyPlansThisWeek || 0) + 1;
    } else if (feature === 'roadmap') {
      user.usageQuota.roadmapsGenerated = (user.usageQuota.roadmapsGenerated || 0) + 1;
    }

    await user.save();
  } catch (err) {
    console.error('Failed to increment feature usage:', err);
  }
};

module.exports = {
  isUserPro,
  requireFeatureQuota,
  incrementFeatureUsage
};
