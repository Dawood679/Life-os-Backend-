const User = require('../models/User');
const LifeScoreLog = require('../models/LifeScoreLog');
const WellnessLog = require('../models/WellnessLog');
const Quiz = require('../models/Quiz');
const Todo = require('../models/Todo');
const StudyPlan = require('../models/StudyPlan');
const { ProjectGenerator } = require('../models/ProjectGenerator');
const { InterviewSession } = require('../models/InterviewSession');
const JobApplication = require('../models/JobApplication');

/**
 * Standard Focus Mode Weight Configurations
 */
const FOCUS_MODE_WEIGHTS = {
  balanced: { health: 0.35, learning: 0.40, career: 0.25 },
  career_sprint: { health: 0.20, learning: 0.30, career: 0.50 },
  student_exam: { health: 0.30, learning: 0.50, career: 0.20 },
  custom: { health: 0.35, learning: 0.40, career: 0.25 }
};

class LifeScoreService {
  /**
   * Helper: Format Date object to 'YYYY-MM-DD'
   * @param {Date} dateObj
   */
  getFormattedDate(dateObj = new Date()) {
    const d = new Date(dateObj);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Pure Mathematical Function: Calculate What-If Action Deltas (0 DB Side Effects)
   * @param {Object} breakdown - current daily metrics
   * @param {Object} weights - { health, learning, career }
   */
  calculateActionDeltas(breakdown, weights = FOCUS_MODE_WEIGHTS.balanced) {
    const deltas = [];

    // Health: Water Delta
    const targetMl = breakdown.waterTargetMl || 2000;
    const consumedMl = breakdown.waterConsumedMl || 0;
    const waterCompleted = consumedMl >= targetMl;
    if (!waterCompleted) {
      deltas.push({
        id: 'water',
        action: 'Log 500ml water (+15 pts)',
        points: Math.max(3, Math.round(weights.health * 40 * 0.35)),
        category: 'health',
        isCompleted: false
      });
    } else {
      deltas.push({
        id: 'water',
        action: 'Water hydration goal reached (2000ml)',
        points: 0,
        category: 'health',
        isCompleted: true
      });
    }

    // Health: Sleep Log Delta
    const sleepLogged = (breakdown.sleepHours || 0) > 0;
    if (!sleepLogged) {
      deltas.push({
        id: 'sleep',
        action: 'Log last night sleep (+40 pts)',
        points: Math.max(4, Math.round(weights.health * 40 * 0.4)),
        category: 'health',
        isCompleted: false
      });
    }

    // Learning: Study Task & Quiz Delta
    const learningPoints = (breakdown.quizzesCompleted || 0) * 35 + (breakdown.studyTasksEarnedPoints || (breakdown.studyTasksCompleted || 0) * 25);
    if (learningPoints < 50) {
      const remainingNeeded = Math.max(15, 50 - learningPoints);
      deltas.push({
        id: 'quiz',
        action: `Complete 1 study task or quiz (+${remainingNeeded} pts to reach 100% Learning)`,
        points: Math.max(5, Math.round(weights.learning * 100 * 0.25)),
        category: 'learning',
        isCompleted: false
      });
    } else {
      deltas.push({
        id: 'quiz',
        action: 'Daily Learning Quota 100% Achieved! 🌟',
        points: 0,
        category: 'learning',
        isCompleted: true
      });
    }

    // Career / Action Delta
    const careerUnits = ((breakdown.actionMilestonesCompleted || 0) * 1.5) + (breakdown.todosCompleted || 0) + ((breakdown.interviewsCompleted || 0) * 1.5);
    if (careerUnits < 2.0) {
      deltas.push({
        id: 'todos',
        action: 'Complete 1 to-do, action milestone, or mock interview to reach 100% Career',
        points: Math.max(4, Math.round(weights.career * 100 * 0.3)),
        category: 'career',
        isCompleted: false
      });
    } else {
      deltas.push({
        id: 'todos',
        action: 'Daily Career Quota 100% Achieved! 🚀',
        points: 0,
        category: 'career',
        isCompleted: true
      });
    }

    return deltas;
  }

  /**
   * Calculate and save/update the daily Life Score for a user
   * @param {string} userId
   * @param {string} targetDate - 'YYYY-MM-DD'
   */
  async calculateDailyScore(userId, targetDate = null) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const dateStr = targetDate || this.getFormattedDate();
    const focusMode = user.focusMode || 'balanced';
    const weights = user.focusWeights || FOCUS_MODE_WEIGHTS[focusMode] || FOCUS_MODE_WEIGHTS.balanced;

    // Date range boundaries for day queries
    const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
    const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);

    // 1. Fetch Health Metrics (WellnessLog)
    const wellnessLog = await WellnessLog.findOne({ user: userId, date: dateStr });
    let waterConsumed = 0;
    let waterTarget = 2000;
    let sleepHours = 0;
    let moodScore = 0;
    let healthLogged = false;

    let sleepPoints = 0;
    let waterPoints = 0;
    let moodPoints = 0;

    if (wellnessLog) {
      if (wellnessLog.sleep && wellnessLog.sleep.hours > 0) {
        sleepHours = wellnessLog.sleep.hours;
        sleepPoints = sleepHours >= 6 ? 45 : Math.round((sleepHours / 6) * 45);
        healthLogged = true;
      }
      if (wellnessLog.water) {
        waterConsumed = wellnessLog.water.consumedMl || 0;
        waterTarget = wellnessLog.water.targetMl || 2000;
        waterPoints = Math.min(45, Math.round((waterConsumed / waterTarget) * 45));
        if (waterConsumed > 0) healthLogged = true;
      }
      if (wellnessLog.mood && wellnessLog.mood.value) {
        moodScore = wellnessLog.mood.value;
        moodPoints = Math.min(10, moodScore * 2);
        healthLogged = true;
      }
    }

    let finalHealthScore = 0;
    if (healthLogged) {
      finalHealthScore = Math.min(100, sleepPoints + waterPoints + moodPoints);
    } else {
      finalHealthScore = 0; // Pure 0 start until user logs wellness today
    }

    // 2. Fetch Learning Metrics (Quizzes + Study Plan Tasks completed TODAY)
    const [todayQuizzes, userStudyPlans] = await Promise.all([
      Quiz.find({
        user: userId,
        isSubmitted: true,
        updatedAt: { $gte: startOfDay, $lte: endOfDay }
      }),
      StudyPlan.find({ user: userId })
    ]);

    let quizzesCompleted = todayQuizzes.length;
    let quizAvgPercentage = 0;
    if (quizzesCompleted > 0) {
      const totalPct = todayQuizzes.reduce((acc, q) => acc + (q.percentage || (q.score / (q.totalMarks || 10)) * 100 || 0), 0);
      quizAvgPercentage = Math.round(totalPct / quizzesCompleted);
    }

    let studyTasksTotal = 0;
    let studyTasksCompletedToday = 0;
    let studyTasksEarnedPointsToday = 0;

    userStudyPlans.forEach(plan => {
      if (plan.tasks && Array.isArray(plan.tasks)) {
        studyTasksTotal += plan.tasks.length;
        plan.tasks.forEach(t => {
          if (t.isCompleted) {
            const completedDate = t.completedAt ? new Date(t.completedAt) : new Date(plan.updatedAt);
            if (completedDate >= startOfDay && completedDate <= endOfDay) {
              studyTasksCompletedToday++;
              studyTasksEarnedPointsToday += t.points || 25;
            }
          }
        });
      }
    });

    // Daily Learning Velocity: Target = 50 points in a day gives 100/100!
    const earnedDailyLearningPoints = (quizzesCompleted * 35) + studyTasksEarnedPointsToday;

    let learningComponentScore = 0;
    if (earnedDailyLearningPoints >= 50) {
      learningComponentScore = 100; // Full 100/100 reached!
    } else if (earnedDailyLearningPoints >= 30) {
      learningComponentScore = Math.round(75 + ((earnedDailyLearningPoints - 30) / 20) * 25);
    } else if (earnedDailyLearningPoints >= 15) {
      learningComponentScore = Math.round(50 + ((earnedDailyLearningPoints - 15) / 15) * 25);
    } else if (earnedDailyLearningPoints > 0) {
      learningComponentScore = Math.round((earnedDailyLearningPoints / 15) * 50);
    } else {
      learningComponentScore = 0; // Pure 0 start until user completes study task/quiz today
    }
    const finalLearningScore = Math.min(100, Math.max(0, Math.round(learningComponentScore)));

    // 3. Fetch Career / Action Metrics (Todos + Action Plan Milestones completed TODAY)
    // 3. Fetch Career / Action Metrics (Todos + Action Milestones + Mock Interviews + Job Applications)
    const [userTodos, userProjects, todayInterviews, todayJobApps] = await Promise.all([
      Todo.find({ user: userId }),
      ProjectGenerator.find({ user: userId }),
      InterviewSession.find({
        user: userId,
        status: 'completed',
        completedAt: { $gte: startOfDay, $lte: endOfDay }
      }),
      JobApplication.find({
        user: userId,
        $or: [
          { appliedDate: { $gte: startOfDay, $lte: endOfDay } },
          { updatedAt: { $gte: startOfDay, $lte: endOfDay } }
        ]
      })
    ]);

    let todosCompletedToday = 0;
    let todosTotal = 0;
    userTodos.forEach(t => {
      if (new Date(t.createdAt) <= endOfDay) {
        todosTotal++;
        if (t.isCompleted) {
          const compDate = t.completedAt ? new Date(t.completedAt) : new Date(t.updatedAt);
          if (compDate >= startOfDay && compDate <= endOfDay) {
            todosCompletedToday++;
          }
        }
      }
    });

    let actionMilestonesTotal = 0;
    let actionMilestonesCompletedToday = 0;
    userProjects.forEach(proj => {
      if (proj.milestones && Array.isArray(proj.milestones)) {
        actionMilestonesTotal += proj.milestones.length;
        proj.milestones.forEach(m => {
          if (m.isCompleted) {
            const compDate = m.completedAt ? new Date(m.completedAt) : new Date(proj.updatedAt);
            if (compDate >= startOfDay && compDate <= endOfDay) {
              actionMilestonesCompletedToday++;
            }
          }
        });
      }
    });

    let interviewsCompletedToday = todayInterviews.length;
    let interviewActionUnits = 0;
    todayInterviews.forEach(sess => {
      const score = sess.scorecard?.overallScore || 70;
      if (score >= 75) {
        interviewActionUnits += 2.0; // High quality mock interview gives instant full career quota!
      } else {
        interviewActionUnits += 1.5;
      }
    });

    let jobApplicationsSubmittedToday = 0;
    let jobInterviewPromotionsToday = 0;
    todayJobApps.forEach(app => {
      if (app.status !== 'wishlist') {
        const appDate = app.appliedDate ? new Date(app.appliedDate) : new Date(app.createdAt);
        if (appDate >= startOfDay && appDate <= endOfDay) {
          jobApplicationsSubmittedToday++;
        }
      }
      if (app.status === 'interviewing' || app.status === 'offer') {
        const updateDate = new Date(app.updatedAt);
        if (updateDate >= startOfDay && updateDate <= endOfDay) {
          jobInterviewPromotionsToday++;
        }
      }
    });

    // Daily Career Velocity: Target = 2 action units
    // (1 Mock Interview = 1.5-2 units, 1 Milestone = 1.5 units, 1 Todo = 1 unit, 1 Job Application = 1 unit, 1 Interview Promotion = 1.5 units)
    const earnedCareerActionUnits =
      (actionMilestonesCompletedToday * 1.5) +
      (todosCompletedToday * 1.0) +
      interviewActionUnits +
      (jobApplicationsSubmittedToday * 1.0) +
      (jobInterviewPromotionsToday * 1.5);

    let careerComponentScore = 0;
    if (earnedCareerActionUnits >= 2.0) {
      careerComponentScore = 100; // Full 100/100 reached!
    } else if (earnedCareerActionUnits >= 1.0) {
      careerComponentScore = Math.round(65 + ((earnedCareerActionUnits - 1.0) / 1.0) * 35);
    } else if (earnedCareerActionUnits > 0) {
      careerComponentScore = Math.round(earnedCareerActionUnits * 65);
    } else {
      careerComponentScore = 0; // Pure 0 start until user completes action milestone/todo/interview/job application today
    }
    const finalCareerScore = Math.min(100, Math.max(0, Math.round(careerComponentScore)));

    // 4. Calculate Final Composite Score
    const rawTotalScore =
      finalHealthScore * (weights.health || 0.35) +
      finalLearningScore * (weights.learning || 0.40) +
      finalCareerScore * (weights.career || 0.25);

    const totalScore = Math.min(100, Math.max(0, Math.round(rawTotalScore)));

    // Breakdown object
    const breakdown = {
      energyScore: wellnessLog?.energyScore || finalHealthScore,
      waterConsumedMl: waterConsumed,
      waterTargetMl: waterTarget,
      sleepHours: sleepHours,
      moodScore: moodScore,
      quizzesCompleted: quizzesCompleted,
      quizAvgPercentage: quizAvgPercentage,
      studyTasksCompleted: studyTasksCompletedToday,
      studyTasksTotal: studyTasksTotal,
      studyTasksEarnedPoints: studyTasksEarnedPointsToday,
      todosCompleted: todosCompletedToday,
      todosTotal: todosTotal,
      actionMilestonesCompleted: actionMilestonesCompletedToday,
      actionMilestonesTotal: actionMilestonesTotal,
      interviewsCompleted: interviewsCompletedToday,
      jobApplicationsSubmitted: jobApplicationsSubmittedToday
    };

    // Calculate action suggestions
    const deltas = this.calculateActionDeltas(breakdown, weights);

    // Save or update today's snapshot in LifeScoreLog
    const scoreLog = await LifeScoreLog.findOneAndUpdate(
      { user: userId, date: dateStr },
      {
        totalScore,
        healthScore: finalHealthScore,
        learningScore: finalLearningScore,
        careerScore: finalCareerScore,
        focusMode,
        weights,
        breakdown,
        insights: [
          `Health Score: ${finalHealthScore}/100 (${Math.round((weights.health || 0.35) * 100)}% weight)`,
          `Learning Score: ${finalLearningScore}/100 (${Math.round((weights.learning || 0.40) * 100)}% weight)`,
          `Career/Productivity Score: ${finalCareerScore}/100 (${Math.round((weights.career || 0.25) * 100)}% weight)`
        ]
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

    // 5. Update User Streak (If activity qualifies: any meaningful action or score >= 15)
    if (totalScore >= 15 || healthLogged || earnedDailyLearningPoints > 0 || earnedCareerActionUnits > 0) {
      const todayFormatted = this.getFormattedDate();
      const lastActive = user.streak?.lastActiveDate;

      if (lastActive !== todayFormatted) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayFormatted = this.getFormattedDate(yesterday);

        let newCurrent = 1;
        if (lastActive === yesterdayFormatted) {
          newCurrent = (user.streak?.current || 0) + 1;
        }

        const newLongest = Math.max(user.streak?.longest || 0, newCurrent);

        user.streak = {
          current: newCurrent,
          longest: newLongest,
          lastActiveDate: todayFormatted
        };
        await user.save();
      }
    }

    return {
      date: dateStr,
      totalScore,
      healthScore: finalHealthScore,
      learningScore: finalLearningScore,
      careerScore: finalCareerScore,
      focusMode,
      weights,
      breakdown,
      streak: user.streak || { current: 0, longest: 0 },
      deltas,
      logId: scoreLog._id
    };
  }

  /**
   * Alias for calculateDailyScore
   */
  async recalculateDailyScore(userId, targetDate = null) {
    return this.calculateDailyScore(userId, targetDate);
  }

  /**
   * Get historical score snapshots
   * @param {string} userId
   * @param {number} days - number of days to look back
   */
  async getLifeScoreHistory(userId, days = 7) {
    const logs = await LifeScoreLog.find({ user: userId })
      .sort({ date: -1 })
      .limit(days);

    return logs.reverse();
  }
}

module.exports = new LifeScoreService();
