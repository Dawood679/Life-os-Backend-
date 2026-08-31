const User = require('../models/User');
const Todo = require('../models/Todo');
const JobApplication = require('../models/JobApplication');
const StudyPlan = require('../models/StudyPlan');
const WellnessLog = require('../models/WellnessLog');
const LifeScoreLog = require('../models/LifeScoreLog');
const { InterviewSession } = require('../models/InterviewSession');
const DailyBriefing = require('../models/DailyBriefing');
const Notification = require('../models/Notification');
const { generateContentWithRetry } = require('../config/gemini');

class DailyBriefingService {
  /**
   * Helper: Resolve user's local calendar date string ('YYYY-MM-DD') and period ('morning' | 'evening')
   * Morning: 04:00 - 17:59:59 (04:00 - 18:00)
   * Evening: 18:00 - 03:59:59 (18:00 - 04:00)
   */
  getUserLocalDateTimeAndPeriod(timezone = 'Asia/Dhaka') {
    const validTz = timezone && typeof timezone === 'string' ? timezone : 'Asia/Dhaka';
    let localDateStr;
    let localHour;

    try {
      const now = new Date();
      // Format to YYYY-MM-DD in user's timezone
      localDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: validTz }).format(now);
      
      // Get current local 24-hour integer (0-23)
      const hourStr = new Intl.DateTimeFormat('en-US', {
        timeZone: validTz,
        hour: 'numeric',
        hour12: false
      }).format(now);
      localHour = parseInt(hourStr, 10);
      if (isNaN(localHour)) localHour = 8;
    } catch {
      // Fallback in case of invalid timezone string
      const now = new Date();
      localDateStr = now.toISOString().split('T')[0];
      localHour = now.getUTCHours();
    }

    const period = localHour >= 4 && localHour < 18 ? 'morning' : 'evening';
    return { localDateStr, localHour, period };
  }

  /**
   * Pure Deterministic Context Aggregator (0 AI Hallucinations)
   * Gathers and calculates all ground truth facts across Health, Learning, Career, and Todos
   */
  async aggregateUserContext(userId, localDateStr, period, timezone = 'Asia/Dhaka') {
    const startOfDay = new Date(`${localDateStr}T00:00:00.000Z`);
    const endOfDay = new Date(`${localDateStr}T23:59:59.999Z`);

    const [user, userTodos, userJobApps, userStudyPlans, todayWellness, todayLifeScoreLog, todayInterviews] =
      await Promise.all([
        User.findById(userId),
        Todo.find({ user: userId }),
        JobApplication.find({ user: userId }),
        StudyPlan.find({ user: userId }),
        WellnessLog.findOne({ user: userId, date: localDateStr }),
        LifeScoreLog.findOne({ user: userId, date: localDateStr }),
        InterviewSession.find({
          user: userId,
          status: 'completed',
          completedAt: { $gte: startOfDay, $lte: endOfDay }
        })
      ]);

    // 1. Todos Aggregation
    let todosActive = 0;
    let todosCompletedToday = 0;
    const highPriorityTodos = [];
    userTodos.forEach((t) => {
      if (t.isCompleted) {
        const compDate = t.completedAt ? new Date(t.completedAt) : new Date(t.updatedAt);
        if (compDate >= startOfDay && compDate <= endOfDay) {
          todosCompletedToday++;
        }
      } else {
        todosActive++;
        if (t.priority === 'high' || t.priority === 'urgent') {
          highPriorityTodos.push({ title: t.title, priority: t.priority });
        }
      }
    });

    // 2. Job Applications & Interviews Aggregation
    const todayInterviewsScheduled = [];
    const followUpsDueToday = [];
    let activeInterviewCount = 0;
    let totalJobApps = userJobApps.length;

    userJobApps.forEach((app) => {
      if (app.interviewDate) {
        const iDate = new Date(app.interviewDate).toISOString().split('T')[0];
        if (iDate === localDateStr) {
          todayInterviewsScheduled.push({
            company: app.company,
            roleTitle: app.roleTitle,
            interviewDate: iDate
          });
        }
      }
      if (app.status === 'interviewing') {
        activeInterviewCount++;
      }
      if (app.status === 'applied' && app.followUpDate) {
        const fDate = new Date(app.followUpDate).toISOString().split('T')[0];
        if (fDate <= localDateStr) {
          followUpsDueToday.push({
            company: app.company,
            roleTitle: app.roleTitle,
            followUpDate: fDate
          });
        }
      }
    });

    // 3. Learning & Study Plans Aggregation
    const activeStudyTasks = [];
    userStudyPlans.forEach((plan) => {
      if (plan.tasks && Array.isArray(plan.tasks)) {
        plan.tasks.forEach((task) => {
          if (!task.isCompleted && activeStudyTasks.length < 3) {
            activeStudyTasks.push({
              planTitle: plan.topic || plan.canonicalSkill || 'Study Plan',
              taskTitle: task.title,
              points: task.points || 25
            });
          }
        });
      }
    });

    // 4. Health & Wellness Aggregation
    const waterConsumedMl = todayWellness?.water?.consumedMl || 0;
    const waterTargetMl = todayWellness?.water?.targetMl || 2000;
    const sleepHours = todayWellness?.sleep?.hours || 0;
    const moodScore = todayWellness?.mood?.value || 0;

    // 5. Life Score & Streak Calculation
    const compositeScore = todayLifeScoreLog?.totalScore || 0;
    const healthScore = todayLifeScoreLog?.healthScore || 0;
    const learningScore = todayLifeScoreLog?.learningScore || 0;
    const careerScore = todayLifeScoreLog?.careerScore || 0;
    const streakCount = user?.streak?.current || 0;
    // Streak is secured if composite score >= 15 or 1+ meaningful action done today
    const streakSecured =
      compositeScore >= 15 ||
      todosCompletedToday > 0 ||
      waterConsumedMl > 0 ||
      sleepHours > 0 ||
      todayInterviews.length > 0;

    return {
      userName: user?.name || 'Explorer',
      primaryDomain: user?.primaryDomain || 'Software Engineering',
      focusMode: user?.focusMode || 'balanced',
      localDateStr,
      period,
      stats: {
        compositeScore,
        healthScore,
        learningScore,
        careerScore,
        streakCount,
        streakSecured,
        todosActive,
        todosCompletedToday,
        highPriorityTodos,
        todayInterviewsScheduled,
        followUpsDueToday,
        activeInterviewCount,
        totalJobApps,
        activeStudyTasks,
        waterConsumedMl,
        waterTargetMl,
        sleepHours,
        moodScore
      }
    };
  }

  /**
   * Deterministic Template Fallback (Guarantees Zero Silent Failures)
   */
  buildDeterministicFallback(userName, context, period) {
    const { stats } = context;
    const isMorning = period === 'morning';

    let greeting = isMorning
      ? `Good morning, ${userName}! Here is your executive briefing.`
      : `Good evening, ${userName}! Here is your daily performance recap.`;

    let executiveSummary = '';
    if (isMorning) {
      if (stats.todayInterviewsScheduled.length > 0) {
        executiveSummary = `You have an interview scheduled today with ${stats.todayInterviewsScheduled[0].company} for ${stats.todayInterviewsScheduled[0].roleTitle}. Prioritize interview warmup and log your daily water target.`;
      } else if (stats.followUpsDueToday.length > 0) {
        executiveSummary = `You have ${stats.followUpsDueToday.length} job application follow-up(s) due today and ${stats.todosActive} active tasks. Target +1.0 Career Action unit to maintain your streak.`;
      } else if (stats.activeStudyTasks.length > 0) {
        executiveSummary = `Your top focus is advancing your study plan (${stats.activeStudyTasks[0].planTitle}). You have ${stats.todosActive} active tasks on your agenda.`;
      } else {
        executiveSummary = `Welcome to your LifeOS agenda. Your pipeline is clean. Start by adding a career target, taking a quick quiz, or logging your daily wellness.`;
      }
    } else {
      if (stats.streakSecured) {
        executiveSummary = `Great execution today! You achieved a composite Life Score of ${stats.compositeScore}/100 and secured your ${stats.streakCount}-day streak. Rest well and hydrate before bed.`;
      } else {
        executiveSummary = `Your daily Life Score is at ${stats.compositeScore}/100. Complete 1 quick action or hydration check before midnight to secure your streak!`;
      }
    }

    const priorities = [];
    if (stats.todayInterviewsScheduled.length > 0) {
      priorities.push({
        title: `Interview Round: ${stats.todayInterviewsScheduled[0].company}`,
        category: 'career',
        actionUrl: '/career/mock-interview',
        urgency: 'high'
      });
    }
    if (stats.followUpsDueToday.length > 0) {
      priorities.push({
        title: `Follow up with ${stats.followUpsDueToday[0].company}`,
        category: 'career',
        actionUrl: '/career/applications',
        urgency: 'high'
      });
    }
    if (stats.activeStudyTasks.length > 0) {
      priorities.push({
        title: `Study: ${stats.activeStudyTasks[0].taskTitle}`,
        category: 'learning',
        actionUrl: '/learning/study-plan',
        urgency: 'medium'
      });
    }
    if (stats.highPriorityTodos.length > 0) {
      priorities.push({
        title: `Task: ${stats.highPriorityTodos[0].title}`,
        category: 'task',
        actionUrl: '/create-todo',
        urgency: 'medium'
      });
    }
    if (stats.waterConsumedMl < stats.waterTargetMl) {
      priorities.push({
        title: `Hydrate: ${stats.waterTargetMl - stats.waterConsumedMl}ml water needed`,
        category: 'health',
        actionUrl: '/health/wellness',
        urgency: 'medium'
      });
    }

    const careerAlerts = [];
    if (stats.todayInterviewsScheduled.length > 0) {
      careerAlerts.push(`Interview scheduled today with ${stats.todayInterviewsScheduled[0].company}`);
    }
    if (stats.followUpsDueToday.length > 0) {
      careerAlerts.push(`Follow-up due for ${stats.followUpsDueToday[0].company}`);
    }

    const learningFocus =
      stats.activeStudyTasks.length > 0
        ? `Focus on "${stats.activeStudyTasks[0].taskTitle}" in ${stats.activeStudyTasks[0].planTitle}`
        : 'Complete a micro-quiz to boost your daily learning score.';

    const healthWellnessAdvice =
      stats.waterConsumedMl >= stats.waterTargetMl
        ? 'Hydration goal achieved (2000ml). Keep up the optimal energy!'
        : `Drink 500ml water to reach your ${stats.waterTargetMl}ml daily hydration target.`;

    const lifeScoreInsight =
      stats.compositeScore >= 80
        ? 'Excellent daily velocity! You are operating in top-tier focus.'
        : `Current Life Score is ${stats.compositeScore}/100. Complete 1 career or study task to hit 100%.`;

    const quotes = [
      'Small daily improvements over time lead to stunning results.',
      'Action cures anxiety. Focus on the next single milestone.',
      'Consistency is the hallmark of the unimaginably successful.',
      'Mastery is not an accident; it is the product of deliberate daily practice.'
    ];
    const motivationalQuote = quotes[Math.floor(Math.random() * quotes.length)];

    return {
      greeting,
      executiveSummary,
      priorities: priorities.slice(0, 4),
      careerAlerts,
      learningFocus,
      healthWellnessAdvice,
      lifeScoreInsight,
      motivationalQuote,
      statsSnapshot: {
        compositeScore: stats.compositeScore,
        streakCount: stats.streakCount,
        streakSecured: stats.streakSecured,
        todosActive: stats.todosActive,
        todosCompleted: stats.todosCompletedToday,
        interviewsScheduled: stats.todayInterviewsScheduled.length,
        followUpsDue: stats.followUpsDueToday.length,
        waterConsumedMl: stats.waterConsumedMl,
        waterTargetMl: stats.waterTargetMl,
        sleepHours: stats.sleepHours
      },
      isAiGenerated: false,
      tokenUsage: { promptTokens: 0, responseTokens: 0, totalTokens: 0, estimatedCostUsd: 0 }
    };
  }

  /**
   * Gemini AI Structured Narrative Generator
   * Injects strictly validated facts and receives executive narrative & storytelling
   */
  async generateAiNarrative(userName, context, period) {
    const { stats, primaryDomain, focusMode } = context;
    const isMorning = period === 'morning';

    const systemPrompt = `You are LIFEOS Executive AI — a world-class personal chief of staff, career advisor, and wellness strategist.
Your task is to generate a personalized, high-impact ${isMorning ? 'Daily Morning Briefing' : 'Evening Performance Recap'} for ${userName}.

STRICT DATA RULES:
1. Do NOT invent or recalculate any numbers. Use ONLY the exact numbers provided in the Ground Truth JSON.
2. If interviewsScheduled is 0, do NOT mention any fake interviews.
3. If followUpsDue is 0, do NOT invent fake follow-ups.
4. Keep the tone concise, authoritative, motivating, and deeply actionable.
5. Return strictly valid JSON adhering to the required schema.`;

    const userPrompt = `Generate the ${isMorning ? 'Morning Briefing' : 'Evening Recap'} based on these verified facts:
GROUND TRUTH:
- User Name: ${userName}
- Primary Domain: ${primaryDomain}
- Focus Mode: ${focusMode}
- Period: ${period}
- Composite Life Score: ${stats.compositeScore}/100 (Health: ${stats.healthScore}, Learning: ${stats.learningScore}, Career: ${stats.careerScore})
- Streak: ${stats.streakCount} days (Secured today: ${stats.streakSecured})
- Active Todos: ${stats.todosActive}, Completed Today: ${stats.todosCompletedToday}
- Scheduled Interviews Today: ${JSON.stringify(stats.todayInterviewsScheduled)}
- Follow-ups Due Today: ${JSON.stringify(stats.followUpsDueToday)}
- Active Study Tasks: ${JSON.stringify(stats.activeStudyTasks)}
- Water Consumed: ${stats.waterConsumedMl}ml / ${stats.waterTargetMl}ml
- Sleep Logged: ${stats.sleepHours} hours

Output JSON format:
{
  "greeting": "Personalized single line greeting",
  "executiveSummary": "2-3 crisp sentences highlighting today's critical path and performance",
  "priorities": [
    { "title": "Specific action item", "category": "career|learning|health|task", "actionUrl": "/path", "urgency": "high|medium|low" }
  ],
  "careerAlerts": ["Alert 1"],
  "learningFocus": "Targeted 1-sentence study recommendation",
  "healthWellnessAdvice": "1-sentence hydration or wellness recommendation",
  "lifeScoreInsight": "1-sentence advice on how to improve or celebrate Life Score",
  "motivationalQuote": "1 crisp quote relevant to domain"
}`;

    const config = {
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        temperature: 0.3
      }
    };

    const response = await generateContentWithRetry([userPrompt], config);
    const text = response.text();
    const parsed = JSON.parse(text);

    // Calculate token usage & cost
    const usage = response.usageMetadata || {};
    const promptTokens = usage.promptTokenCount || 400;
    const responseTokens = usage.candidatesTokenCount || 250;
    const totalTokens = promptTokens + responseTokens;
    const estimatedCostUsd = (promptTokens * 0.075 + responseTokens * 0.30) / 1000000;

    // Ensure actionUrls are safe
    const safePriorities = (parsed.priorities || []).map((p) => {
      let actionUrl = '/dashboard';
      if (p.category === 'career') {
        actionUrl = stats.todayInterviewsScheduled.length > 0 ? '/career/mock-interview' : '/career/applications';
      } else if (p.category === 'learning') {
        actionUrl = '/learning/study-plan';
      } else if (p.category === 'health') {
        actionUrl = '/health/wellness';
      } else if (p.category === 'task') {
        actionUrl = '/create-todo';
      }
      return {
        title: p.title || 'Focus Task',
        category: p.category || 'task',
        actionUrl: p.actionUrl || actionUrl,
        urgency: p.urgency || 'medium'
      };
    });

    return {
      greeting: parsed.greeting || `Welcome to your LifeOS agenda, ${userName}!`,
      executiveSummary: parsed.executiveSummary || 'Your daily agenda has been synthesized.',
      priorities: safePriorities.slice(0, 4),
      careerAlerts: parsed.careerAlerts || [],
      learningFocus: parsed.learningFocus || '',
      healthWellnessAdvice: parsed.healthWellnessAdvice || '',
      lifeScoreInsight: parsed.lifeScoreInsight || '',
      motivationalQuote: parsed.motivationalQuote || '',
      statsSnapshot: {
        compositeScore: stats.compositeScore,
        streakCount: stats.streakCount,
        streakSecured: stats.streakSecured,
        todosActive: stats.todosActive,
        todosCompleted: stats.todosCompletedToday,
        interviewsScheduled: stats.todayInterviewsScheduled.length,
        followUpsDue: stats.followUpsDueToday.length,
        waterConsumedMl: stats.waterConsumedMl,
        waterTargetMl: stats.waterTargetMl,
        sleepHours: stats.sleepHours
      },
      isAiGenerated: true,
      tokenUsage: {
        promptTokens,
        responseTokens,
        totalTokens,
        estimatedCostUsd
      }
    };
  }

  /**
   * Master Method: Get Cached or Generate Fresh Daily Briefing
   */
  async getOrCreateDailyBriefing(userId, clientTimezone = null, forceRegenerate = false) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    const userTimezone = clientTimezone || user.timezone || 'Asia/Dhaka';
    const { localDateStr, period } = this.getUserLocalDateTimeAndPeriod(userTimezone);

    // 1. Check Cache if not force-regenerating
    if (!forceRegenerate) {
      const cached = await DailyBriefing.findOne({
        user: userId,
        date: localDateStr,
        period
      });
      if (cached) {
        return cached;
      }
    }

    // 2. Deterministic Context Aggregation
    const context = await this.aggregateUserContext(userId, localDateStr, period, userTimezone);

    // 3. Try Gemini AI Generation with Deterministic Fallback
    let briefingPayload;
    try {
      briefingPayload = await this.generateAiNarrative(user.name, context, period);
    } catch (aiError) {
      console.warn('[DailyBriefingService] AI generation failed, using deterministic fallback template:', aiError.message);
      briefingPayload = this.buildDeterministicFallback(user.name, context, period);
    }

    // 4. Save or Update in Database
    const savedBriefing = await DailyBriefing.findOneAndUpdate(
      { user: userId, date: localDateStr, period },
      {
        user: userId,
        date: localDateStr,
        period,
        ...briefingPayload
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // 5. Trigger In-App Notification entry (if this is a fresh briefing)
    try {
      const notifTitle =
        period === 'morning'
          ? `☀️ Your Morning Briefing is ready`
          : `🌙 Your Evening Recap is ready (${savedBriefing.statsSnapshot?.compositeScore || 0}/100 pts)`;

      await Notification.create({
        user: userId,
        title: notifTitle,
        message: savedBriefing.executiveSummary.slice(0, 120) + '...',
        type: 'daily_briefing'
      });
    } catch (notifErr) {
      // Non-blocking notification creation
    }

    return savedBriefing;
  }
}

module.exports = new DailyBriefingService();
