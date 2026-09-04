const { ai } = require('../config/gemini');
const { callAIWithFallback } = require('../utils/aiWithFallback');
const User = require('../models/User');
const WellnessLog = require('../models/WellnessLog');
const Todo = require('../models/Todo');
const Quiz = require('../models/Quiz');
const StudyPlan = require('../models/StudyPlan');
const JobApplication = require('../models/JobApplication');
const { InterviewSession } = require('../models/InterviewSession');
const Roadmap = require('../models/Roadmap');
const LifeScoreLog = require('../models/LifeScoreLog');
const { calculateMedicineAdherence } = require('../utils/healthAnalyticsEngine');

const weeklyReportResponseSchema = {
  type: 'object',
  properties: {
    grade: {
      type: 'string',
      enum: ['A+', 'A', 'B+', 'B', 'C', 'D'],
      description: 'Overall weekly performance letter grade based on consistency and output.'
    },
    executiveSummary: {
      type: 'string',
      description: 'Engaging, direct 3-4 sentence narrative correlating health, learning, and career execution with composite Life Score.'
    },
    topWins: {
      type: 'array',
      items: { type: 'string' },
      description: '2-3 major wins or achievements this week across pillars.'
    },
    productivityLeaks: {
      type: 'array',
      items: { type: 'string' },
      description: '1-2 key friction points, missed routines, or productivity bottlenecks.'
    },
    burnoutAndBalanceRisk: {
      type: 'object',
      properties: {
        level: {
          type: 'string',
          enum: ['low', 'moderate', 'high'],
          description: 'Calculated burnout risk level based on sleep, screen time, and workload.'
        },
        assessment: {
          type: 'string',
          description: '1-2 sentence assessment of physical vs cognitive balance.'
        }
      },
      required: ['level', 'assessment']
    },
    nextWeekDirectives: {
      type: 'object',
      properties: {
        health: { type: 'string', description: 'One high-impact health/wellness goal for next week.' },
        learning: { type: 'string', description: 'One high-impact learning/skill goal for next week.' },
        career: { type: 'string', description: 'One high-impact career/execution goal for next week.' }
      },
      required: ['health', 'learning', 'career']
    }
  },
  required: ['grade', 'executiveSummary', 'topWins', 'productivityLeaks', 'burnoutAndBalanceRisk', 'nextWeekDirectives']
};

const weeklyReportConfig = {
  model: 'gemini-2.5-flash',
  config: {
    systemInstruction: `You are LIFEOS AI Master Life & Productivity Strategist — an empathetic, strictly data-driven life analyst and executive life coach.

YOUR PURPOSE:
- Perform an executive weekly audit across all three life pillars: Health & Vitality (sleep, water, screen time, medicine adherence), Learning & Skill Growth (quizzes, study plans, verified skills), and Career Execution (todos, job applications, mock interviews, roadmap milestones).
- Correlate physical wellness and medicine adherence with cognitive focus, study momentum, and career output.
- Provide high-leverage retrospective insights without inventing any numbers.

STRICT RULES:
- Base analysis ONLY on the numbers provided in the user prompt.
- Do NOT hallucinate or assume metrics that are not passed in.
- If wellness or medicine adherence is low and task/study output dipped, highlight the friction.
- If performance is high, celebrate the wins and momentum.
- Output valid JSON strictly adhering to the schema.`,
    responseMimeType: 'application/json',
    responseSchema: weeklyReportResponseSchema,
    temperature: 0.3
  }
};

class WeeklyReportService {
  formatLocalDate(dateObj = new Date(), timeZone = 'Asia/Dhaka') {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date(dateObj));
    } catch {
      const d = new Date(dateObj);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
  }

  /**
   * Aggregate real 7-day data across all LifeOS pillars
   */
  async aggregate7DayStats(userId, userTimezone = 'Asia/Dhaka') {
    const today = new Date();
    const pastWeekDate = new Date(today);
    pastWeekDate.setDate(pastWeekDate.getDate() - 6);
    pastWeekDate.setHours(0, 0, 0, 0);

    const fromDate = this.formatLocalDate(pastWeekDate, userTimezone);
    const toDate = this.formatLocalDate(today, userTimezone);

    // Run parallel queries across all database collections
    const [
      user,
      wellnessLogs,
      adherenceData,
      todos,
      quizzes,
      studyPlans,
      jobApps,
      interviews,
      roadmaps,
      lifeScoreLogs
    ] = await Promise.all([
      User.findById(userId).select('name email streak verifiedSkills focusMode'),
      WellnessLog.find({ user: userId, date: { $gte: fromDate, $lte: toDate } }),
      calculateMedicineAdherence(userId, 7).catch(() => ({ adherenceRate: 100, activeMedicinesCount: 0, takenDoses: 0, totalDoses: 0 })),
      Todo.find({ user: userId, updatedAt: { $gte: pastWeekDate } }),
      Quiz.find({ user: userId, isSubmitted: true, updatedAt: { $gte: pastWeekDate } }),
      StudyPlan.find({ user: userId }),
      JobApplication.find({ user: userId, createdAt: { $gte: pastWeekDate } }),
      InterviewSession.find({ user: userId, isCompleted: true, updatedAt: { $gte: pastWeekDate } }),
      Roadmap.find({ user: userId }),
      LifeScoreLog.find({ user: userId, date: { $gte: fromDate, $lte: toDate } }).sort({ date: 1 })
    ]);

    // 1. Health Aggregation
    let totalSleep = 0;
    let totalWater = 0;
    let totalScreenTime = 0;
    let totalEnergy = 0;
    const daysLogged = wellnessLogs.length;

    wellnessLogs.forEach((log) => {
      totalSleep += log.sleep?.hours || 0;
      totalWater += log.water?.consumedMl || 0;
      totalScreenTime += log.screenTime?.usedMinutes || 0;
      totalEnergy += log.energyScore || 0;
    });

    const avgSleep = daysLogged > 0 ? Number((totalSleep / daysLogged).toFixed(1)) : 0;
    const avgWater = daysLogged > 0 ? Math.round(totalWater / daysLogged) : 0;
    const avgScreenTime = daysLogged > 0 ? Math.round(totalScreenTime / daysLogged) : 0;
    const avgEnergy = daysLogged > 0 ? Math.round(totalEnergy / daysLogged) : 0;

    // 2. Learning Aggregation
    const quizzesTaken = quizzes.length;
    let totalQuizPct = 0;
    quizzes.forEach((q) => {
      totalQuizPct += q.percentage || 0;
    });
    const avgQuizScore = quizzesTaken > 0 ? Math.round(totalQuizPct / quizzesTaken) : 0;

    let studyTasksCompleted = 0;
    studyPlans.forEach((plan) => {
      if (Array.isArray(plan.tasks)) {
        studyTasksCompleted += plan.tasks.filter((t) => t.isCompleted).length;
      }
    });

    const verifiedSkillsCount = user?.verifiedSkills?.length || 0;

    // 3. Career & Action Aggregation
    const totalTodos = todos.length;
    const completedTodos = todos.filter((t) => t.status === 'completed' || t.isCompleted).length;
    const todoCompletionRate = totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0;

    const jobApplicationsSubmitted = jobApps.length;
    const mockInterviewsTaken = interviews.length;
    let totalInterviewScore = 0;
    interviews.forEach((i) => {
      totalInterviewScore += i.overallScore || i.scorecard?.overallScore || 0;
    });
    const avgInterviewScore = mockInterviewsTaken > 0 ? Math.round(totalInterviewScore / mockInterviewsTaken) : 0;

    let roadmapMilestonesCompleted = 0;
    roadmaps.forEach((r) => {
      if (Array.isArray(r.phases)) {
        r.phases.forEach((p) => {
          if (Array.isArray(p.milestones)) {
            roadmapMilestonesCompleted += p.milestones.filter((m) => m.isCompleted).length;
          }
        });
      }
    });

    // 4. Life Score Aggregation
    let totalScoreSum = 0;
    const scoreHistory = lifeScoreLogs.map((l) => ({
      date: l.date,
      score: l.totalScore,
      health: l.healthScore,
      learning: l.learningScore,
      career: l.careerScore
    }));

    lifeScoreLogs.forEach((l) => {
      totalScoreSum += l.totalScore || 0;
    });
    const avgLifeScore = lifeScoreLogs.length > 0 ? Math.round(totalScoreSum / lifeScoreLogs.length) : 0;

    return {
      window: {
        fromDate,
        toDate,
        daysCount: 7
      },
      userSummary: {
        name: user?.name || 'User',
        focusMode: user?.focusMode || 'balanced',
        streak: user?.streak?.current || 0
      },
      health: {
        daysLogged,
        avgSleep,
        avgWater,
        avgScreenTime,
        avgEnergy,
        medicineAdherenceRate: adherenceData?.adherenceRate !== undefined ? adherenceData.adherenceRate : 100,
        activeMedicinesCount: adherenceData?.activeMedicinesCount || 0
      },
      learning: {
        quizzesTaken,
        avgQuizScore,
        studyTasksCompleted,
        verifiedSkillsCount
      },
      career: {
        totalTodos,
        completedTodos,
        todoCompletionRate,
        jobApplicationsSubmitted,
        mockInterviewsTaken,
        avgInterviewScore,
        roadmapMilestonesCompleted
      },
      lifeScore: {
        avgScore: avgLifeScore,
        scoreHistory
      }
    };
  }

  /**
   * Generate Master Weekly Life Report via Gemini / Groq
   */
  async generateWeeklyReport(userId, userTimezone = 'Asia/Dhaka') {
    const stats = await this.aggregate7DayStats(userId, userTimezone);

    const prompt = `
Analyze the following 7-day comprehensive LifeOS data for ${stats.userSummary.name} (Focus Mode: ${stats.userSummary.focusMode}, Streak: ${stats.userSummary.streak} days):

--- 1. HEALTH & VITALITY (7-Day Period: ${stats.window.fromDate} to ${stats.window.toDate}) ---
- Wellness Days Logged: ${stats.health.daysLogged} / 7 days
- Average Sleep: ${stats.health.avgSleep} hours/night
- Average Water Intake: ${stats.health.avgWater} ml/day (Target: 2000ml)
- Average Daily Screen Time: ${stats.health.avgScreenTime} minutes
- Average Energy Score: ${stats.health.avgEnergy} / 100
- Active Medicines: ${stats.health.activeMedicinesCount} | Medicine Adherence Rate: ${stats.health.medicineAdherenceRate}%

--- 2. LEARNING & SKILL GROWTH ---
- AI Quizzes Completed: ${stats.learning.quizzesTaken}
- Average Quiz Score: ${stats.learning.avgQuizScore}%
- Study Tasks Completed: ${stats.learning.studyTasksCompleted}
- Total Verified Skill Badges: ${stats.learning.verifiedSkillsCount}

--- 3. CAREER & ACTION EXECUTION ---
- Todos Completed: ${stats.career.completedTodos} / ${stats.career.totalTodos} (${stats.career.todoCompletionRate}% completion rate)
- Job Applications Sent: ${stats.career.jobApplicationsSubmitted}
- AI Mock Interviews Completed: ${stats.career.mockInterviewsTaken} (Avg Score: ${stats.career.avgInterviewScore}/100)
- 90-Day Roadmap Milestones Cleared: ${stats.career.roadmapMilestonesCompleted}

--- 4. IMMUTABLE LIFE SCORE ---
- 7-Day Average Life Score: ${stats.lifeScore.avgScore} / 100

Perform a multi-pillar synthesis. Correlate sleep, hydration, screen time, and medicine adherence with task and study productivity. Highlight real wins and clear bottlenecks. Provide an overall grade (A+, A, B+, B, C, D) and actionable directives for next week.
`;

    const aiResponse = await callAIWithFallback(ai, weeklyReportConfig, prompt);
    const parsed = aiResponse.parsed || JSON.parse(aiResponse.text);

    // Robust field normalization across Gemini and Groq
    const grade = parsed.grade || parsed.overallGrade || (stats.lifeScore.avgScore >= 80 ? 'A' : stats.lifeScore.avgScore >= 60 ? 'B' : stats.lifeScore.avgScore >= 40 ? 'C' : 'D');
    const executiveSummary = parsed.executiveSummary || parsed.summary || parsed.report || '7-day multi-pillar retrospective generated.';
    const topWins = Array.isArray(parsed.topWins) ? parsed.topWins : Array.isArray(parsed.wins) ? parsed.wins : ['Logged wellness data and stayed active in LifeOS.'];
    const productivityLeaks = Array.isArray(parsed.productivityLeaks) ? parsed.productivityLeaks : Array.isArray(parsed.bottlenecks) ? parsed.bottlenecks : ['Inconsistent logging or skipped routines.'];
    
    let burnoutAndBalanceRisk = parsed.burnoutAndBalanceRisk;
    if (!burnoutAndBalanceRisk || typeof burnoutAndBalanceRisk !== 'object' || !burnoutAndBalanceRisk.level) {
      burnoutAndBalanceRisk = {
        level: stats.health.avgSleep > 0 && stats.health.avgSleep < 5.5 ? 'moderate' : stats.health.avgSleep === 0 ? 'moderate' : 'low',
        assessment: stats.health.avgSleep < 5.5 
          ? 'Sleep hours dipped this week. Focus on restorative sleep and evening wind-down.' 
          : 'Healthy balance maintained across active routines.'
      };
    }

    let nextWeekDirectives = parsed.nextWeekDirectives;
    if (!nextWeekDirectives || typeof nextWeekDirectives !== 'object' || !nextWeekDirectives.health) {
      if (Array.isArray(parsed.directives)) {
        nextWeekDirectives = {
          health: parsed.directives[0]?.actions?.[0] || 'Target 2000ml water daily and 7h+ sleep.',
          learning: parsed.directives[1]?.actions?.[0] || 'Complete 1 AI study plan task or quiz.',
          career: parsed.directives[2]?.actions?.[0] || 'Complete high-priority daily agenda tasks.'
        };
      } else {
        nextWeekDirectives = {
          health: 'Target 2000ml water daily and consistent sleep.',
          learning: 'Complete 1 AI study plan task or skill quiz.',
          career: 'Focus on completing top 3 priority to-dos.'
        };
      }
    }

    const normalizedReport = {
      grade,
      executiveSummary,
      topWins,
      productivityLeaks,
      burnoutAndBalanceRisk,
      nextWeekDirectives
    };

    return {
      success: true,
      provider: aiResponse.provider,
      generatedAt: new Date().toISOString(),
      report: normalizedReport,
      stats
    };
  }
}

module.exports = new WeeklyReportService();
