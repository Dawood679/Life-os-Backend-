const User = require('../models/User');
const LifeScoreLog = require('../models/LifeScoreLog');
const WellnessLog = require('../models/WellnessLog');
const Quiz = require('../models/Quiz');
const Todo = require('../models/Todo');

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
      const remainingWaterPct = Math.min(1, (targetMl - consumedMl) / targetMl);
      const points = Math.max(2, Math.round(weights.health * 40 * remainingWaterPct * 0.3));
      deltas.push({
        id: 'water',
        action: 'Log 500ml water',
        points: Math.min(8, points || 4),
        category: 'health',
        isCompleted: false
      });
    } else {
      deltas.push({
        id: 'water',
        action: 'Water goal reached (2000ml)',
        points: 0,
        category: 'health',
        isCompleted: true
      });
    }

    // Health: Sleep Log Delta
    const sleepLogged = (breakdown.sleepHours || 0) > 0;
    if (!sleepLogged) {
      const points = Math.max(3, Math.round(weights.health * 40 * 0.4));
      deltas.push({
        id: 'sleep',
        action: 'Log last night sleep',
        points: points || 5,
        category: 'health',
        isCompleted: false
      });
    }

    // Learning: Daily Quiz Delta
    const quizCount = breakdown.quizzesCompleted || 0;
    if (quizCount === 0) {
      const points = Math.max(4, Math.round(weights.learning * 100 * 0.2));
      deltas.push({
        id: 'quiz',
        action: 'Pass 1 daily quiz (80%+)',
        points: points || 8,
        category: 'learning',
        isCompleted: false
      });
    } else {
      deltas.push({
        id: 'quiz',
        action: `${quizCount} quiz completed today`,
        points: 0,
        category: 'learning',
        isCompleted: true
      });
    }

    // Career / Productivity: To-Do Delta
    const totalTodos = breakdown.todosTotal || 0;
    const completedTodos = breakdown.todosCompleted || 0;
    if (totalTodos > 0 && completedTodos < totalTodos) {
      const remainingTodos = totalTodos - completedTodos;
      const points = Math.max(2, Math.round(weights.career * 100 * (remainingTodos / totalTodos) * 0.3));
      deltas.push({
        id: 'todos',
        action: `Complete ${remainingTodos} remaining task${remainingTodos > 1 ? 's' : ''}`,
        points: Math.min(10, points || 5),
        category: 'career',
        isCompleted: false
      });
    } else if (totalTodos === 0) {
      deltas.push({
        id: 'todos',
        action: 'Add and complete a priority to-do',
        points: Math.max(3, Math.round(weights.career * 30)),
        category: 'career',
        isCompleted: false
      });
    } else {
      deltas.push({
        id: 'todos',
        action: 'All daily tasks completed',
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

    let healthComponentScore = 0;
    let healthMetricCount = 0;

    if (wellnessLog) {
      if (wellnessLog.energyScore !== null && wellnessLog.energyScore !== undefined && wellnessLog.energyScore > 0) {
        healthComponentScore = wellnessLog.energyScore;
        healthMetricCount = 3;
      } else {
        if (wellnessLog.water) {
          waterConsumed = wellnessLog.water.consumedMl || 0;
          waterTarget = wellnessLog.water.targetMl || 2000;
          const waterScore = Math.min(100, Math.round((waterConsumed / waterTarget) * 100));
          healthComponentScore += waterScore * 0.4;
          healthMetricCount++;
        }

        if (wellnessLog.sleep && wellnessLog.sleep.hours) {
          sleepHours = wellnessLog.sleep.hours;
          let sleepScore = 50;
          if (sleepHours >= 7 && sleepHours <= 9) sleepScore = 100;
          else if (sleepHours === 6 || sleepHours === 10) sleepScore = 80;
          else if (sleepHours === 5 || sleepHours === 11) sleepScore = 60;
          else sleepScore = 30;

          healthComponentScore += sleepScore * 0.4;
          healthMetricCount++;
        }

        if (wellnessLog.mood && wellnessLog.mood.value) {
          moodScore = wellnessLog.mood.value;
          const normalizedMood = moodScore * 20; // 1-5 -> 20-100
          healthComponentScore += normalizedMood * 0.2;
          healthMetricCount++;
        }
      }

      if (wellnessLog.water) {
        waterConsumed = wellnessLog.water.consumedMl || 0;
        waterTarget = wellnessLog.water.targetMl || 2000;
      }
      if (wellnessLog.sleep) sleepHours = wellnessLog.sleep.hours || 0;
      if (wellnessLog.mood) moodScore = wellnessLog.mood.value || 0;
    }

    // Default baseline if no wellness logged yet today
    if (healthMetricCount === 0) {
      healthComponentScore = 30; // Base presence
    }
    const finalHealthScore = Math.min(100, Math.max(0, Math.round(healthComponentScore)));

    // 2. Fetch Learning Metrics (Quizzes)
    const todayQuizzes = await Quiz.find({
      user: userId,
      isSubmitted: true,
      updatedAt: { $gte: startOfDay, $lte: endOfDay }
    });

    let quizzesCompleted = todayQuizzes.length;
    let quizAvgPercentage = 0;
    let learningComponentScore = 0;

    if (quizzesCompleted > 0) {
      const totalPct = todayQuizzes.reduce((acc, q) => acc + (q.percentage || (q.score / (q.totalMarks || 10)) * 100 || 0), 0);
      quizAvgPercentage = Math.round(totalPct / quizzesCompleted);
      learningComponentScore = Math.min(100, 40 + quizAvgPercentage * 0.6); // 40 base + up to 60 for performance
    } else {
      // Baseline if user has verified skills previously or active learning profile
      const verifiedCount = (user.verifiedSkills && user.verifiedSkills.length) || 0;
      learningComponentScore = Math.min(40, verifiedCount * 10 || 25);
    }
    const finalLearningScore = Math.min(100, Math.max(0, Math.round(learningComponentScore)));

    // 3. Fetch Career / Productivity Metrics (Todos)
    const todayTodos = await Todo.find({
      user: userId,
      createdAt: { $lte: endOfDay }
    });

    const todosTotal = todayTodos.length;
    const todosCompleted = todayTodos.filter((t) => t.isCompleted).length;
    let careerComponentScore = 0;

    if (todosTotal > 0) {
      const todoRatio = todosCompleted / todosTotal;
      careerComponentScore = Math.round(todoRatio * 100);
    } else {
      careerComponentScore = 50; // Neutral if no to-dos assigned
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
      studyTasksCompleted: 0,
      todosCompleted: todosCompleted,
      todosTotal: todosTotal
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
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // 5. Update User Streak (If activity qualifies: totalScore >= 30)
    if (totalScore >= 30) {
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
