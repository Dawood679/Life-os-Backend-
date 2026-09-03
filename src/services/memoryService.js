const User = require('../models/User');
const JobApplication = require('../models/JobApplication');
const { InterviewSession } = require('../models/InterviewSession');
const Roadmap = require('../models/Roadmap');
const WellnessLog = require('../models/WellnessLog');

// In-Memory Process RAM Cache (Sub-microsecond latency, 0 external infrastructure)
const userMemoryCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL

/**
 * Invalidate in-memory cache for a specific user upon state mutations
 */
const clearUserMemoryCache = (userId) => {
  if (!userId) return;
  userMemoryCache.delete(userId.toString());
};

/**
 * Format date to YYYY-MM-DD
 */
const getFormattedLocalDate = (dateObj = new Date(), timeZone = 'Asia/Dhaka') => {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date(dateObj));
  } catch {
    const d = new Date(dateObj);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
};

/**
 * Fetch and synthesize compact user life context snapshot (< 80 tokens)
 */
const getUserLifeMemory = async (userId, timeZone = 'Asia/Dhaka') => {
  if (!userId) return null;
  const userKey = userId.toString();

  // 1. Check in-memory RAM cache
  const cached = userMemoryCache.get(userKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  try {
    const today = new Date();
    const todayDateStr = getFormattedLocalDate(today, timeZone);

    // 2. Parallel multi-source database aggregation
    const [userDoc, upcomingJobs, latestInterview, activeRoadmap, todayWellness] = await Promise.all([
      User.findById(userId).select('name focusGoal verifiedSkills').lean(),
      JobApplication.find({
        user: userId,
        status: { $in: ['interview', 'applied', 'technical'] },
        interviewDate: { $gte: today }
      })
        .sort({ interviewDate: 1 })
        .limit(2)
        .select('company jobTitle interviewDate status')
        .lean(),
      InterviewSession.findOne({ user: userId })
        .sort({ createdAt: -1 })
        .select('role targetCompany overallScore feedback.weaknesses')
        .lean(),
      Roadmap.findOne({ user: userId })
        .sort({ updatedAt: -1 })
        .select('title currentPhase progress')
        .lean(),
      WellnessLog.findOne({ user: userId, date: todayDateStr })
        .select('water.consumedMl sleep.hours mood.value')
        .lean()
    ]);

    // 3. Format upcoming interviews with days remaining
    const formattedInterviews = (upcomingJobs || []).map((job) => {
      const diffTime = new Date(job.interviewDate).getTime() - today.getTime();
      const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      return {
        company: job.company,
        role: job.jobTitle,
        daysRemaining
      };
    });

    // 4. Extract latest interview insights
    let interviewInsights = null;
    if (latestInterview) {
      const weaknesses = (latestInterview.feedback?.weaknesses || []).slice(0, 2);
      interviewInsights = {
        role: latestInterview.role,
        score: `${latestInterview.overallScore || 70}%`,
        topicsToPolish: weaknesses
      };
    }

    // 5. Compile ultra-compact memory profile
    const memorySnapshot = {
      userName: userDoc?.name || 'User',
      focusGoal: userDoc?.focusGoal || 'Full-Stack Software Engineer',
      upcomingInterviews: formattedInterviews,
      lastInterview: interviewInsights,
      activeRoadmap: activeRoadmap
        ? {
            title: activeRoadmap.title,
            currentPhase: activeRoadmap.currentPhase || 'Phase 1',
            progress: `${activeRoadmap.progress || 0}%`
          }
        : null,
      verifiedSkills: (userDoc?.verifiedSkills || []).slice(0, 3),
      todayWellness: {
        waterMl: todayWellness?.water?.consumedMl || 0,
        sleepHours: todayWellness?.sleep?.hours || 0,
        mood: todayWellness?.mood?.value || 3
      }
    };

    // 6. Save to in-memory RAM cache with TTL
    userMemoryCache.set(userKey, {
      data: memorySnapshot,
      expiresAt: Date.now() + CACHE_TTL_MS
    });

    return memorySnapshot;
  } catch (error) {
    console.error('Error fetching user life memory:', error.message);
    return null;
  }
};

module.exports = {
  getUserLifeMemory,
  clearUserMemoryCache
};
