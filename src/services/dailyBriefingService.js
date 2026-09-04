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
    const activeTodos = [];
    userTodos.forEach((t) => {
      if (t.isCompleted) {
        const compDate = t.completedAt ? new Date(t.completedAt) : new Date(t.updatedAt);
        if (compDate >= startOfDay && compDate <= endOfDay) {
          todosCompletedToday++;
        }
      } else {
        todosActive++;
        activeTodos.push({ title: t.title, priority: t.priority || 'medium' });
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
        activeTodos,
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
   * Zero-Token Deterministic Human Conversational Audio Script Builder
   * Constructs natural, empathetic, spoken English briefing with exact Life Score, task counts, and adaptive motivation.
   */
  buildConversationalAudioScript(userName, stats, period, localHour = null, motivationalQuote = null) {
    const isMorning = period === 'morning';
    const score = stats.compositeScore || 0;
    const completedTasks = stats.todosCompletedToday || 0;
    const totalTasks = (stats.todosActive || 0) + completedTasks;
    const water = stats.waterConsumedMl || 0;
    const waterTarget = stats.waterTargetMl || 2000;

    let greeting = `Good morning, ${userName}.`;
    if (localHour !== null && localHour !== undefined) {
      if (localHour >= 12 && localHour < 17) greeting = `Good afternoon, ${userName}.`;
      else if (localHour >= 17 && localHour < 22) greeting = `Good evening, ${userName}.`;
      else if (localHour >= 22 || localHour < 4) greeting = `Welcome back, ${userName}.`;
      else greeting = `Good morning, ${userName}.`;
    } else if (!isMorning) {
      greeting = `Good evening, ${userName}.`;
    }

    let scoreSection = `Your Life Score today is currently sitting at ${score} out of 100.`;

    // Exact Dashboard Task Section
    let taskSection = "";
    const primaryTask = stats.highPriorityTodos?.[0]?.title || stats.activeTodos?.[0]?.title;
    const secondaryTask = stats.highPriorityTodos?.[1]?.title || stats.activeTodos?.[1]?.title;

    if (totalTasks === 0) {
      taskSection = isMorning
        ? `Your agenda is clean for today with no scheduled tasks.`
        : `You had a quiet agenda with no scheduled tasks today.`;
    } else if (completedTasks === totalTasks && totalTasks > 0) {
      taskSection = `You have completed all ${completedTasks} of your scheduled tasks today! Tremendous execution.`;
    } else if (primaryTask) {
      taskSection = `You have ${stats.todosActive} active task${stats.todosActive > 1 ? 's' : ''} on your agenda today. Your top priority is "${primaryTask}"${secondaryTask ? `, followed by "${secondaryTask}"` : ''}.`;
    } else {
      taskSection = `You've completed ${completedTasks} out of ${totalTasks} tasks today.`;
    }

    let empathySection = "";
    if (stats.todayInterviewsScheduled && stats.todayInterviewsScheduled.length > 0) {
      empathySection = `Your interview round with ${stats.todayInterviewsScheduled[0].company} is scheduled today. Focus on calm confidence and your strengths.`;
    } else if (stats.followUpsDueToday && stats.followUpsDueToday.length > 0) {
      empathySection = `You have a job application follow-up due today with ${stats.followUpsDueToday[0].company}.`;
    }

    let hydrationSection = "";
    if (water < waterTarget) {
      hydrationSection = `Make sure to drink ${waterTarget - water}ml more water before bed to hit your daily hydration target.`;
    } else {
      hydrationSection = `Your hydration goal is fully secured.`;
    }

    const defaultQuote = "Small daily improvements over time lead to stunning results. Keep building momentum!";
    const finalQuote = motivationalQuote || defaultQuote;
    const motivationalSection = ` Remember: ${finalQuote}`;

    return `${greeting} ${scoreSection} ${taskSection} ${empathySection ? empathySection + ' ' : ''}${hydrationSection}${motivationalSection}`;
  }

  /**
   * Deterministic Template Fallback (Guarantees Zero Silent Failures)
   */
  buildDeterministicFallback(userName, context, period) {
    const { stats, localHour } = context;
    const isMorning = period === 'morning';

    let greeting = isMorning
      ? `Good morning, ${userName}! Here is your executive briefing.`
      : `Good evening, ${userName}! Here is your daily performance recap.`;

    if (localHour !== null && localHour !== undefined) {
      if (localHour >= 12 && localHour < 17) greeting = `Good afternoon, ${userName}! Here is your midday agenda.`;
      else if (localHour >= 17 && localHour < 22) greeting = `Good evening, ${userName}! Here is your executive recap.`;
      else if (localHour >= 22 || localHour < 4) greeting = `Welcome back, ${userName}! Here is your nightly overview.`;
    }

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
    const spokenAudioScript = this.buildConversationalAudioScript(userName, stats, period, context?.localHour, motivationalQuote);

    return {
      greeting,
      executiveSummary,
      priorities: priorities.slice(0, 4),
      careerAlerts,
      learningFocus,
      healthWellnessAdvice,
      lifeScoreInsight,
      spokenAudioScript,
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
   * Gemini Pro Structured AI Synthesis
   */
  async generateAiNarrative(userName, context, period) {
    const { stats } = context;
    const isMorning = period === 'morning';

    const systemPrompt = `You are the Executive Chief of Staff for a hyper-productive professional using LifeOS.
Your objective is to produce a high-impact, inspiring, and concise daily agenda in strictly valid JSON format.
Analyze the provided user ground truth stats and generate a structured executive briefing.

Return ONLY a JSON object with this exact schema:
{
  "greeting": "Energetic, time-appropriate executive greeting",
  "executiveSummary": "2-3 crisp sentences highlighting today's critical momentum and priorities",
  "priorities": [
    { "title": "Specific action item", "category": "career|learning|health|task", "actionUrl": "/path", "urgency": "high|medium|low" }
  ],
  "careerAlerts": ["Alert 1", "Alert 2"],
  "learningFocus": "Targeted 1-sentence study recommendation",
  "healthWellnessAdvice": "1-sentence hydration or sleep advice",
  "lifeScoreInsight": "1-sentence tip on how to gain +points on Life Score",
  "motivationalQuote": "A punchy, modern high-performance quote"
}`;

    const userPrompt = `USER GROUND TRUTH CONTEXT:
- User Name: ${userName}
- Time Period: ${period} (${isMorning ? 'Start of Day / Midday' : 'Evening Performance Review'})
- Life Score: ${stats.compositeScore}/100 (Health: ${stats.healthScore}, Learning: ${stats.learningScore}, Career: ${stats.careerScore})
- Streak: ${stats.streakCount} days (Secured today: ${stats.streakSecured ? 'YES' : 'NO'})
- Todos: ${stats.todosCompletedToday} completed today, ${stats.todosActive} active remaining
- High Priority Tasks: ${JSON.stringify(stats.highPriorityTodos)}
- Interviews Scheduled Today: ${JSON.stringify(stats.todayInterviewsScheduled)}
- Follow-ups Due Today: ${JSON.stringify(stats.followUpsDueToday)}
- Active Study Tasks: ${JSON.stringify(stats.activeStudyTasks)}
- Water Consumed: ${stats.waterConsumedMl}ml / ${stats.waterTargetMl}ml
- Sleep: ${stats.sleepHours} hours

Generate the personalized JSON executive briefing.`;

    const rawResponse = await generateContentWithRetry(systemPrompt + '\n\n' + userPrompt);
    const parsed = this.parseAiJsonResponse(rawResponse);

    const promptTokens = 450;
    const responseTokens = 220;
    const totalTokens = promptTokens + responseTokens;
    const estimatedCostUsd = (promptTokens * 0.0000005) + (responseTokens * 0.0000015);

    // Sanitize priorities array
    const rawPriorities = Array.isArray(parsed.priorities) ? parsed.priorities : [];
    const safePriorities = rawPriorities.map((p) => {
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

    const activeQuote = parsed.motivationalQuote || 'Small daily improvements over time lead to stunning results.';

    return {
      greeting: parsed.greeting || `Welcome to your LifeOS agenda, ${userName}!`,
      executiveSummary: parsed.executiveSummary || 'Your daily agenda has been synthesized.',
      priorities: safePriorities.slice(0, 4),
      careerAlerts: parsed.careerAlerts || [],
      learningFocus: parsed.learningFocus || '',
      healthWellnessAdvice: parsed.healthWellnessAdvice || '',
      lifeScoreInsight: parsed.lifeScoreInsight || '',
      spokenAudioScript: this.buildConversationalAudioScript(userName, stats, period, context.localHour, activeQuote),
      motivationalQuote: activeQuote,
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
    const { localDateStr, localHour, period } = this.getUserLocalDateTimeAndPeriod(userTimezone);

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
    context.localHour = localHour;

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
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
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
