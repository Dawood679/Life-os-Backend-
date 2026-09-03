const crypto = require('crypto');
const { ai } = require('../config/gemini');
const callGroq = require('../config/groq');
const CopilotAuditLog = require('../models/CopilotAuditLog');
const Todo = require('../models/Todo');
const WellnessLog = require('../models/WellnessLog');
const StudyPlan = require('../models/StudyPlan');
const { ProjectGenerator } = require('../models/ProjectGenerator');
const lifeScoreService = require('../services/lifeScoreService');
const smartReschedulerService = require('../services/smartReschedulerService');
const memoryService = require('../services/memoryService');

// Global Circuit Breaker State (Resets daily at 00:00 UTC)
let globalDailyAICalls = 0;
let lastResetDate = new Date().toISOString().split('T')[0];
const GLOBAL_DAILY_SPEND_CAP = 10000;

const checkAndResetSpendCap = () => {
  const today = new Date().toISOString().split('T')[0];
  if (today !== lastResetDate) {
    globalDailyAICalls = 0;
    lastResetDate = today;
  }
};

// Helper: Format Date object to 'YYYY-MM-DD' in user timezone
const getFormattedLocalDate = (dateObj = new Date(), timeZone = 'Asia/Dhaka') => {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date(dateObj));
  } catch {
    const d = new Date(dateObj);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
};

/**
 * Handle Natural Language / Voice Copilot Commands with Deep Context Injection
 */
const handleCopilotCommand = async (req, res) => {
  const userId = req.user._id;
  const userTimezone = req.body.timezone || 'Asia/Dhaka';
  const todayDate = getFormattedLocalDate(new Date(), userTimezone);
  const rawCommand = (req.body.command || req.body.message || '').trim();

  if (!rawCommand) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a command or question for AI Copilot.'
    });
  }

  checkAndResetSpendCap();

  // 1. DETERMINISTIC ZERO-TOKEN FAST PATH
  const lower = rawCommand.toLowerCase();
  if (lower === 'log 250ml water' || lower === 'drink 250ml' || lower === '+250ml' || lower === 'water 250') {
    return executeLogWater(userId, todayDate, 250, 'deterministic', rawCommand, res);
  }
  if (lower === 'log 500ml water' || lower === 'drink 500ml' || lower === '+500ml' || lower === 'water 500') {
    return executeLogWater(userId, todayDate, 500, 'deterministic', rawCommand, res);
  }
  if (lower === "what's my agenda today" || lower === "today's agenda" || lower === 'show agenda' || lower === 'my tasks') {
    return executeQueryAgenda(userId, todayDate, 'deterministic', rawCommand, res);
  }
  if (lower === 'my life score' || lower === "what's my score" || lower === 'life score') {
    return executeQueryLifeScore(userId, todayDate, 'deterministic', rawCommand, res);
  }

  // 2. CHECK CIRCUIT BREAKER SPEND CAP
  if (globalDailyAICalls >= GLOBAL_DAILY_SPEND_CAP) {
    return res.status(200).json({
      success: true,
      provider: 'circuit_breaker',
      message: 'System daily AI capacity reached. Switched to high-speed deterministic mode.',
      reply: 'AI is temporarily in conservation mode. You can log water, check tasks, or review scores with instant buttons.',
      quickShortcuts: [
        { label: '+250ml Water', command: 'log 250ml water' },
        { label: '+500ml Water', command: 'log 500ml water' },
        { label: "Today's Agenda", command: "today's agenda" },
        { label: 'Life Score', command: 'my life score' }
      ]
    });
  }

  // 3. FETCH COMPACT MULTI-SOURCE CONTEXT MEMORY (< 80 tokens)
  const userMemory = await memoryService.getUserLifeMemory(userId, userTimezone);

  // 4. LLM PARSING WITH GEMINI PRIMARY + GROQ FALLBACK
  const systemPrompt = `You are LifeOS AI Chief of Staff. You act as an executive mentor and proactive life assistant.
CURRENT USER MEMORY SNAPSHOT:
${JSON.stringify(userMemory || {})}

AVAILABLE TOOLS:
1. "log_water": { "amountMl": number } (e.g. 250, 500, 750, 1000)
2. "log_sleep": { "hours": number, "quality": "poor"|"fair"|"good"|"excellent" }
3. "log_mood": { "value": number 1-5, "note": string }
4. "create_task": { "title": string, "priority": "low"|"medium"|"high"|"urgent", "targetTime": string (e.g. "21:00" or "9pm"), "targetDate": string (e.g. "today"|"tomorrow"|"YYYY-MM-DD"), "repeat": "none"|"daily"|"weekdays"|"weekly"|"monthly"|"custom", "customDays": number[] (0=Sun, 1=Mon, ..., 6=Sat), "reminderMinutesBefore": number, "notificationChannel": "in_app"|"email"|"both"|"none" }
5. "update_task": { "taskKeyword": string, "title": string, "priority": "low"|"medium"|"high"|"urgent", "targetTime": string, "targetDate": string, "repeat": "none"|"daily"|"weekdays"|"weekly"|"monthly"|"custom", "customDays": number[], "reminderMinutesBefore": number, "notificationChannel": "in_app"|"email"|"both"|"none" }
6. "query_agenda": {}
7. "query_score": {}
8. "reschedule_burnout": {} (Defer non-urgent tasks when exhausted)
9. "complete_study_task": { "taskKeyword": string } (Trigger micro-quiz verification for study task)
10. "complete_project_milestone": { "milestoneStep": number, "milestoneKeyword": string } (Mark practical project milestone complete)
11. "open_job_match": { "jobDescription": string } (Navigate to Job Match with auto-fill)
12. "summarize_notes": { "notesText": string } (Navigate to Notes Summarizer with auto-fill)
13. "delete_task": { "taskTitleKeyword": string } [DESTRUCTIVE ACTION]
14. "general_qa": { "answer": string } (For conversational advice, interview prep, proactive coaching)

RULES:
- Always respond in valid JSON format only.
- Format: { "tool": string, "args": object, "reply": string }
- When user asks for learning or interview guidance, reference their upcoming interviews and polish topics empathetically without sounding blunt.
- "reply" must be concise, encouraging, and action-oriented.`;

  let aiParsed = null;
  let providerUsed = 'gemini';

  // Primary: Gemini 2.5 Flash
  try {
    globalDailyAICalls++;
    const geminiRes = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2,
        systemInstruction: systemPrompt
      },
      contents: rawCommand
    });

    const clean = geminiRes.text?.replace(/```json/g, '').replace(/```/g, '').trim() || '{}';
    aiParsed = JSON.parse(clean);
    providerUsed = 'gemini';
  } catch (geminiError) {
    console.warn('Gemini Copilot attempt failed, falling back to Groq:', geminiError.message);

    // Backup: Groq Llama-3.3-70b-versatile
    try {
      globalDailyAICalls++;
      const groqRaw = await callGroq(rawCommand, systemPrompt, [], true);
      const clean = groqRaw.replace(/```json/g, '').replace(/```/g, '').trim();
      aiParsed = JSON.parse(clean);
      providerUsed = 'groq';
    } catch (groqError) {
      console.error('Double AI Failure in Copilot:', groqError.message);

      // 5. DOUBLE FAILURE GRACEFUL FALLBACK
      await CopilotAuditLog.create({
        user: userId,
        command: rawCommand,
        intent: 'general_qa',
        status: 'FAILED',
        aiProvider: 'fallback',
        actionResponse: 'Double AI timeout occurred, graceful fallback served.'
      });

      return res.status(200).json({
        success: true,
        provider: 'double_failure_fallback',
        reply: "AI Copilot is momentarily busy due to high network traffic. You can use instant shortcut actions below or retry in a few seconds.",
        quickShortcuts: [
          { label: '+250ml Water', command: 'log 250ml water' },
          { label: '+500ml Water', command: 'log 500ml water' },
          { label: "Today's Agenda", command: "today's agenda" },
          { label: 'Life Score', command: 'my life score' }
        ]
      });
    }
  }

  // 6. SANITY-CHECKING & TOOL EXECUTION
  const tool = aiParsed.tool || 'general_qa';
  const args = aiParsed.args || {};
  let userReply = aiParsed.reply || 'Action processed.';

  // TOOL 1: Log Water
  if (tool === 'log_water') {
    let amount = Number(args.amountMl) || 250;
    if (amount <= 0 || amount > 3000) {
      await CopilotAuditLog.create({
        user: userId,
        command: rawCommand,
        intent: 'log_water',
        detectedTool: 'log_water',
        rawArgs: args,
        status: 'SANITY_REJECTED',
        aiProvider: providerUsed,
        actionResponse: `Sanity rejected water value: ${amount}ml`
      });

      return res.json({
        success: true,
        provider: providerUsed,
        reply: `That water amount (${amount}ml) seems unusually high for a single entry. Did you mean 250ml or 500ml?`,
        quickShortcuts: [
          { label: '+250ml', command: 'log 250ml water' },
          { label: '+500ml', command: 'log 500ml water' }
        ]
      });
    }

    return executeLogWater(userId, todayDate, amount, providerUsed, rawCommand, res, userReply);
  }

  // TOOL 2: Log Sleep
  if (tool === 'log_sleep') {
    let hours = Number(args.hours) || 7.5;
    if (hours <= 0 || hours > 24) {
      return res.json({
        success: true,
        provider: providerUsed,
        reply: `Sleep duration (${hours}h) must be between 1 and 24 hours. Please enter a valid duration.`
      });
    }

    await WellnessLog.findOneAndUpdate(
      { user: userId, date: todayDate },
      { $set: { 'sleep.hours': hours, 'sleep.quality': args.quality || (hours >= 7 ? 'good' : 'fair') } },
      { upsert: true, returnDocument: 'after' }
    );

    const updatedScore = await lifeScoreService.calculateDailyScore(userId, todayDate);
    memoryService.clearUserMemoryCache(userId);

    await CopilotAuditLog.create({
      user: userId,
      command: rawCommand,
      intent: 'log_sleep',
      detectedTool: 'log_sleep',
      sanitizedArgs: { hours, quality: args.quality },
      status: 'EXECUTED',
      aiProvider: providerUsed,
      actionResponse: userReply
    });

    return res.json({
      success: true,
      provider: providerUsed,
      reply: userReply || `Logged ${hours} hours of sleep! Health & Energy score updated 😴`,
      lifeScore: updatedScore
    });
  }

  // TOOL 3: Create Task (With Intelligent Timing, Channel & Recurrence)
  if (tool === 'create_task') {
    const title = (args.title || '').trim();
    if (!title || title.length < 2) {
      return res.json({
        success: true,
        provider: providerUsed,
        reply: "Please provide a clear title for the action item you would like to schedule."
      });
    }

    const priority = ['low', 'medium', 'high', 'urgent'].includes(args.priority) ? args.priority : 'medium';
    const repeat = ['none', 'daily', 'weekdays', 'weekly', 'monthly', 'custom'].includes(args.repeat) ? args.repeat : 'none';
    const customDays = Array.isArray(args.customDays) ? args.customDays.map(Number).filter(n => n >= 0 && n <= 6) : [];
    const notificationChannel = ['in_app', 'email', 'both', 'none'].includes(args.notificationChannel) ? args.notificationChannel : 'in_app';

    // Parse target date (Today, Tomorrow, or specific YYYY-MM-DD)
    let baseDate = new Date();
    if (args.targetDate === 'tomorrow') {
      baseDate.setDate(baseDate.getDate() + 1);
    } else if (args.targetDate && args.targetDate !== 'today') {
      const parsedDate = new Date(args.targetDate);
      if (!isNaN(parsedDate.getTime())) {
        baseDate = parsedDate;
      }
    }

    // Parse target time (e.g. "21:00", "9:00 PM", "9pm")
    let targetHours = 21; // default evening if specified
    let targetMinutes = 0;
    let hasExplicitTime = false;

    if (args.targetTime) {
      hasExplicitTime = true;
      const rawTime = args.targetTime.toLowerCase().trim();
      const isPm = rawTime.includes('pm') || rawTime.includes('p.m.');
      const isAm = rawTime.includes('am') || rawTime.includes('a.m.');
      const cleanTime = rawTime.replace(/[^\d:]/g, '');
      const parts = cleanTime.split(':');

      if (parts.length >= 1 && !isNaN(parseInt(parts[0], 10))) {
        let h = parseInt(parts[0], 10);
        let m = parts.length >= 2 ? parseInt(parts[1], 10) : 0;
        if (isPm && h < 12) h += 12;
        if (isAm && h === 12) h = 0;
        targetHours = h;
        targetMinutes = isNaN(m) ? 0 : m;
      }
    }

    if (hasExplicitTime) {
      baseDate.setHours(targetHours, targetMinutes, 0, 0);
    }

    const finalDueDate = baseDate;
    const reminderMinutesBefore = Number(args.reminderMinutesBefore) >= 0 ? Number(args.reminderMinutesBefore) : 10;
    const reminderTime = new Date(finalDueDate.getTime() - reminderMinutesBefore * 60 * 1000);

    const newTodo = await Todo.create({
      user: userId,
      title,
      priority,
      dueDate: finalDueDate,
      repeat,
      customDays,
      notificationChannel,
      reminderMinutesBefore,
      reminderTime
    });

    const updatedScore = await lifeScoreService.calculateDailyScore(userId, todayDate);

    await CopilotAuditLog.create({
      user: userId,
      command: rawCommand,
      intent: 'create_task',
      detectedTool: 'create_task',
      sanitizedArgs: { title, priority, dueDate: finalDueDate, repeat, notificationChannel, reminderMinutesBefore, reminderTime },
      status: 'EXECUTED',
      aiProvider: providerUsed,
      actionResponse: userReply
    });

    const formattedTime = finalDueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const formattedReminder = reminderTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const channelLabel = notificationChannel === 'both' ? 'in-app bell and email' : notificationChannel === 'email' ? 'email' : 'in-app bell';
    const repeatLabel = repeat !== 'none' ? ` (${repeat})` : '';

    const dynamicReply = userReply || `Scheduled "${title}" for ${formattedTime}${repeatLabel} with an ${channelLabel} reminder at ${formattedReminder} (10m prior) ⏰`;

    return res.json({
      success: true,
      provider: providerUsed,
      reply: dynamicReply,
      todo: newTodo,
      lifeScore: updatedScore
    });
  }

  // TOOL 4: Update Existing Task (Notifications, Time, Priority, Recurrence)
  if (tool === 'update_task') {
    const keyword = (args.taskKeyword || '').trim().toLowerCase();
    let candidate = null;

    if (keyword) {
      candidate = await Todo.findOne({
        user: userId,
        isCompleted: false,
        title: { $regex: keyword, $options: 'i' }
      }).sort({ updatedAt: -1 });
    }

    if (!candidate) {
      candidate = await Todo.findOne({ user: userId, isCompleted: false }).sort({ updatedAt: -1 });
    }

    if (!candidate) {
      return res.json({
        success: true,
        provider: providerUsed,
        reply: `I couldn't find an active task matching "${keyword || 'your request'}". Would you like me to create a new one?`
      });
    }

    if (args.title && args.title.trim().length >= 2) {
      candidate.title = args.title.trim();
    }
    if (args.priority && ['low', 'medium', 'high', 'urgent'].includes(args.priority)) {
      candidate.priority = args.priority;
    }
    if (args.repeat && ['none', 'daily', 'weekdays', 'weekly', 'monthly', 'custom'].includes(args.repeat)) {
      candidate.repeat = args.repeat;
    }
    if (args.customDays && Array.isArray(args.customDays)) {
      candidate.customDays = args.customDays.map(Number).filter(n => n >= 0 && n <= 6);
    }
    if (args.notificationChannel && ['in_app', 'email', 'both', 'none'].includes(args.notificationChannel)) {
      candidate.notificationChannel = args.notificationChannel;
    }
    if (args.reminderMinutesBefore !== undefined && Number(args.reminderMinutesBefore) >= 0) {
      candidate.reminderMinutesBefore = Number(args.reminderMinutesBefore);
    }

    // Time & Date updates if requested
    if (args.targetTime) {
      const rawTime = args.targetTime.toLowerCase().trim();
      const isPm = rawTime.includes('pm') || rawTime.includes('p.m.');
      const isAm = rawTime.includes('am') || rawTime.includes('a.m.');
      const cleanTime = rawTime.replace(/[^\d:]/g, '');
      const parts = cleanTime.split(':');

      if (parts.length >= 1 && !isNaN(parseInt(parts[0], 10))) {
        let h = parseInt(parts[0], 10);
        let m = parts.length >= 2 ? parseInt(parts[1], 10) : 0;
        if (isPm && h < 12) h += 12;
        if (isAm && h === 12) h = 0;
        const currentDue = new Date(candidate.dueDate || new Date());
        currentDue.setHours(h, isNaN(m) ? 0 : m, 0, 0);
        candidate.dueDate = currentDue;
      }
    }

    const offset = candidate.reminderMinutesBefore !== undefined ? candidate.reminderMinutesBefore : 10;
    candidate.reminderTime = new Date(new Date(candidate.dueDate).getTime() - offset * 60 * 1000);
    candidate.reminderSent = false;
    await candidate.save();

    const updatedScore = await lifeScoreService.calculateDailyScore(userId, todayDate);

    await CopilotAuditLog.create({
      user: userId,
      command: rawCommand,
      intent: 'update_task',
      detectedTool: 'update_task',
      sanitizedArgs: { taskId: candidate._id, title: candidate.title, notificationChannel: candidate.notificationChannel, reminderTime: candidate.reminderTime },
      status: 'EXECUTED',
      aiProvider: providerUsed,
      actionResponse: userReply
    });

    const formattedReminder = candidate.reminderTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const channelLabel = candidate.notificationChannel === 'both' ? 'in-app bell & email' : candidate.notificationChannel === 'email' ? 'email' : 'in-app bell';

    const dynamicReply = userReply || `Updated "${candidate.title}"! Reminder set for ${formattedReminder} via ${channelLabel} (10m prior) ⏰`;

    return res.json({
      success: true,
      provider: providerUsed,
      reply: dynamicReply,
      todo: candidate,
      lifeScore: updatedScore
    });
  }

  // TOOL 5: Query Agenda
  if (tool === 'query_agenda') {
    return executeQueryAgenda(userId, todayDate, providerUsed, rawCommand, res, userReply);
  }

  // TOOL 6: Query Life Score
  if (tool === 'query_score') {
    return executeQueryLifeScore(userId, todayDate, providerUsed, rawCommand, res, userReply);
  }

  // TOOL 6: Reschedule Burnout
  if (tool === 'reschedule_burnout') {
    const recoveryResult = await smartReschedulerService.applyBurnoutRecovery(userId, userTimezone);
    const updatedScore = await lifeScoreService.calculateDailyScore(userId, todayDate);

    await CopilotAuditLog.create({
      user: userId,
      command: rawCommand,
      intent: 'reschedule_burnout',
      detectedTool: 'reschedule_burnout',
      status: 'EXECUTED',
      aiProvider: providerUsed,
      actionResponse: userReply
    });

    return res.json({
      success: true,
      provider: providerUsed,
      reply: userReply || `Burnout Guard activated: Deferred ${recoveryResult.deferredCount || 0} non-urgent tasks to tomorrow. Your streak is protected 🛡️`,
      recoveryResult,
      lifeScore: updatedScore
    });
  }

  // TOOL 7: Study Plan Task Micro-Quiz Trigger (Active Recall Verification)
  if (tool === 'complete_study_task') {
    const keyword = (args.taskKeyword || '').toLowerCase().trim();
    const activeStudyPlan = await StudyPlan.findOne({ user: userId }).sort({ updatedAt: -1 });

    if (!activeStudyPlan || !activeStudyPlan.tasks || activeStudyPlan.tasks.length === 0) {
      return res.json({
        success: true,
        provider: providerUsed,
        reply: "You don't have an active study plan yet. Generate one in Study Planner to start active recall!"
      });
    }

    // Find target task by keyword or first uncompleted task
    let targetTask = activeStudyPlan.tasks.find(
      (t) => !t.isCompleted && (keyword ? t.title.toLowerCase().includes(keyword) : true)
    );

    if (!targetTask) {
      targetTask = activeStudyPlan.tasks.find((t) => !t.isCompleted) || activeStudyPlan.tasks[0];
    }

    if (targetTask.isCompleted) {
      return res.json({
        success: true,
        provider: providerUsed,
        reply: `The study task "${targetTask.title}" is already completed! Ready for the next one? ✨`
      });
    }

    // Return pre-cached micro-quiz from database (0 New AI Tokens!)
    return res.json({
      success: true,
      provider: providerUsed,
      type: 'STUDY_QUIZ',
      studyPlanId: activeStudyPlan._id,
      taskNumber: targetTask.taskNumber,
      taskTitle: targetTask.title,
      questions: targetTask.microQuiz || [],
      reply: `To complete "${targetTask.title}" and earn +${targetTask.points} study points, answer the micro-quiz below to verify your understanding 🧠:`
    });
  }

  // TOOL 8: Action Plan Project Milestone Direct Completion
  if (tool === 'complete_project_milestone') {
    const activeProject = await ProjectGenerator.findOne({ user: userId }).sort({ updatedAt: -1 });

    if (!activeProject || !activeProject.milestones || activeProject.milestones.length === 0) {
      return res.json({
        success: true,
        provider: providerUsed,
        reply: "No active action plan found. Generate a project architecture in Action Plan Generator to track milestones!"
      });
    }

    const stepNum = Number(args.milestoneStep);
    const keyword = (args.milestoneKeyword || '').toLowerCase();

    let milestone = activeProject.milestones.find(
      (m) =>
        (stepNum && m.stepNumber === stepNum) ||
        (keyword && m.title.toLowerCase().includes(keyword)) ||
        !m.isCompleted
    );

    if (!milestone) {
      milestone = activeProject.milestones[0];
    }

    milestone.isCompleted = true;
    milestone.completedAt = new Date();
    await activeProject.save();

    const updatedScore = await lifeScoreService.calculateDailyScore(userId, todayDate);
    memoryService.clearUserMemoryCache(userId);

    await CopilotAuditLog.create({
      user: userId,
      command: rawCommand,
      intent: 'complete_project_milestone',
      detectedTool: 'complete_project_milestone',
      sanitizedArgs: { stepNumber: milestone.stepNumber, title: milestone.title },
      status: 'EXECUTED',
      aiProvider: providerUsed,
      actionResponse: `Completed milestone: ${milestone.title}`
    });

    return res.json({
      success: true,
      provider: providerUsed,
      reply: `Completed Step ${milestone.stepNumber}: "${milestone.title}" in your Action Plan! Career momentum boosted 🚀`,
      lifeScore: updatedScore
    });
  }

  // TOOL 9: Deep-Link to Job Match with Auto-Fill
  if (tool === 'open_job_match') {
    return res.json({
      success: true,
      provider: providerUsed,
      type: 'DEEP_LINK',
      target: '/job-match',
      prefillData: { jobDescription: args.jobDescription || '' },
      reply: "Navigating you to Job Matcher with pre-filled role details ➔"
    });
  }

  // TOOL 10: Deep-Link to Notes Summarizer with Auto-Fill
  if (tool === 'summarize_notes') {
    return res.json({
      success: true,
      provider: providerUsed,
      type: 'DEEP_LINK',
      target: '/notes-summarizer',
      prefillData: { text: args.notesText || '' },
      reply: "Opening Notes Summarizer to process your study notes ➔"
    });
  }

  // TOOL 11: TWO-PHASE COMMIT FOR DESTRUCTIVE ACTION (Delete Task)
  if (tool === 'delete_task') {
    const keyword = (args.taskTitleKeyword || '').trim().toLowerCase();
    const candidate = await Todo.findOne({
      user: userId,
      isCompleted: false,
      title: { $regex: keyword || '.*', $options: 'i' }
    });

    if (!candidate) {
      return res.json({
        success: true,
        provider: providerUsed,
        reply: `I could not find an active task matching "${keyword}". No tasks were removed.`
      });
    }

    const token = crypto.randomBytes(16).toString('hex');

    await CopilotAuditLog.create({
      user: userId,
      command: rawCommand,
      intent: 'delete_task',
      detectedTool: 'delete_task',
      isDestructive: true,
      confirmationToken: token,
      rawArgs: { taskId: candidate._id, title: candidate.title },
      status: 'PROPOSED',
      aiProvider: providerUsed,
      actionResponse: `Proposal to delete: ${candidate.title}`
    });

    return res.json({
      success: true,
      provider: providerUsed,
      type: 'PROPOSAL',
      proposal: {
        token,
        actionType: 'delete_task',
        taskId: candidate._id,
        taskTitle: candidate.title,
        message: `Are you sure you want to remove "${candidate.title}" from your agenda?`
      },
      reply: `Please confirm: Would you like me to delete "${candidate.title}"?`
    });
  }

  // TOOL 12: General QA / Conversational response with Memory
  await CopilotAuditLog.create({
    user: userId,
    command: rawCommand,
    intent: 'general_qa',
    detectedTool: 'general_qa',
    status: 'EXECUTED',
    aiProvider: providerUsed,
    actionResponse: userReply
  });

  return res.json({
    success: true,
    provider: providerUsed,
    reply: userReply,
    userMemory
  });
};

/**
 * Verify and Submit Micro-Quiz for Study Plan Task
 */
const submitStudyTaskQuiz = async (req, res) => {
  try {
    const { studyPlanId, taskNumber, userAnswers } = req.body;
    const userId = req.user._id;

    const plan = await StudyPlan.findOne({ _id: studyPlanId, user: userId });
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Study Plan not found.' });
    }

    const task = plan.tasks.find((t) => t.taskNumber === Number(taskNumber));
    if (!task) {
      return res.status(404).json({ success: false, message: 'Study task not found.' });
    }

    // Evaluate answers
    let correctCount = 0;
    const questions = task.microQuiz || [];
    questions.forEach((q, idx) => {
      const selected = (userAnswers && userAnswers[idx]) ? userAnswers[idx].toUpperCase() : '';
      if (selected === q.correctAnswer.toUpperCase()) {
        correctCount++;
      }
    });

    const passThreshold = Math.ceil(questions.length * 0.5) || 1;
    const isPassed = correctCount >= passThreshold || questions.length === 0;

    if (!isPassed) {
      return res.json({
        success: false,
        isPassed: false,
        score: `${correctCount}/${questions.length}`,
        message: `You got ${correctCount} out of ${questions.length} correct. Review the concept and try again to complete the task!`
      });
    }

    // Mark task completed
    task.isCompleted = true;
    task.completedAt = new Date();
    plan.earnedPoints = (plan.earnedPoints || 0) + (task.points || 20);

    const totalTasks = plan.tasks.length;
    const completedTasks = plan.tasks.filter((t) => t.isCompleted).length;
    plan.completionPercentage = Math.round((completedTasks / totalTasks) * 100);

    await plan.save();

    const todayDate = getFormattedLocalDate(new Date());
    const updatedScore = await lifeScoreService.calculateDailyScore(userId, todayDate);
    memoryService.clearUserMemoryCache(userId);

    return res.json({
      success: true,
      isPassed: true,
      score: `${correctCount}/${questions.length}`,
      message: `Verified! You passed the active recall quiz (${correctCount}/${questions.length}) and completed "${task.title}" (+${task.points} pts)! 🧠🎉`,
      studyPlan: plan,
      lifeScore: updatedScore
    });
  } catch (error) {
    console.error('Submit study task quiz error:', error);
    res.status(500).json({ success: false, message: 'Error verifying quiz answers.' });
  }
};

/**
 * Execute Two-Phase Commit Action Confirmation
 */
const confirmAction = async (req, res) => {
  try {
    const { token, confirmed } = req.body;
    const userId = req.user._id;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Confirmation token is required.' });
    }

    const auditEntry = await CopilotAuditLog.findOne({
      user: userId,
      confirmationToken: token,
      status: 'PROPOSED'
    });

    if (!auditEntry) {
      return res.status(404).json({
        success: false,
        message: 'Action proposal has expired or was already handled.'
      });
    }

    if (!confirmed) {
      auditEntry.status = 'CANCELLED';
      auditEntry.confirmationToken = null;
      await auditEntry.save();

      return res.json({
        success: true,
        actionStatus: 'CANCELLED',
        message: 'Action cancelled safely. No changes were made.'
      });
    }

    // Execute Confirmed Destructive Action
    if (auditEntry.intent === 'delete_task') {
      const taskId = auditEntry.rawArgs?.taskId;
      if (taskId) {
        await Todo.findOneAndDelete({ _id: taskId, user: userId });
      }

      auditEntry.status = 'CONFIRMED';
      auditEntry.confirmationToken = null;
      await auditEntry.save();

      const todayDate = getFormattedLocalDate(new Date());
      const updatedScore = await lifeScoreService.calculateDailyScore(userId, todayDate);

      return res.json({
        success: true,
        actionStatus: 'CONFIRMED',
        message: `Task "${auditEntry.rawArgs?.title || ''}" deleted successfully.`,
        lifeScore: updatedScore
      });
    }

    auditEntry.status = 'CONFIRMED';
    await auditEntry.save();

    res.json({ success: true, actionStatus: 'CONFIRMED', message: 'Action executed successfully.' });
  } catch (error) {
    console.error('Confirm Action error:', error);
    res.status(500).json({ success: false, message: 'Server error processing confirmation.' });
  }
};

// Internal Helper: Execute Water Logging
async function executeLogWater(userId, todayDate, amount, provider, command, res, customReply) {
  try {
    const log = await WellnessLog.findOneAndUpdate(
      { user: userId, date: todayDate },
      { $inc: { 'water.consumedMl': amount } },
      { upsert: true, returnDocument: 'after' }
    );

    const updatedScore = await lifeScoreService.calculateDailyScore(userId, todayDate);
    memoryService.clearUserMemoryCache(userId);

    await CopilotAuditLog.create({
      user: userId,
      command,
      intent: 'log_water',
      detectedTool: 'log_water',
      sanitizedArgs: { amountMl: amount },
      status: 'EXECUTED',
      aiProvider: provider,
      actionResponse: `Logged ${amount}ml water`
    });

    const totalWater = log.water?.consumedMl || amount;
    const defaultReply = `Logged +${amount}ml water! Today's total: ${totalWater}/2000 ml 💧 (+1.5 Life Score)`;

    return res.json({
      success: true,
      provider,
      reply: customReply || defaultReply,
      totalWaterMl: totalWater,
      lifeScore: updatedScore
    });
  } catch (error) {
    console.error('Execute log water error:', error);
    return res.status(500).json({ success: false, message: 'Failed to record water intake.' });
  }
}

// Internal Helper: Execute Query Agenda
async function executeQueryAgenda(userId, todayDate, provider, command, res, customReply) {
  try {
    const todos = await Todo.find({ user: userId, isCompleted: false }).limit(5);
    const reply = todos.length > 0
      ? `You have ${todos.length} active priorities today: ${todos.map(t => `"${t.title}"`).join(', ')}.`
      : "You have no pending tasks on your agenda today! Ready for your next milestone? ✨";

    await CopilotAuditLog.create({
      user: userId,
      command,
      intent: 'query_agenda',
      detectedTool: 'query_agenda',
      status: 'EXECUTED',
      aiProvider: provider,
      actionResponse: reply
    });

    return res.json({
      success: true,
      provider,
      reply: customReply || reply,
      todos
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to query agenda.' });
  }
}

// Internal Helper: Execute Query Life Score
async function executeQueryLifeScore(userId, todayDate, provider, command, res, customReply) {
  try {
    const scoreData = await lifeScoreService.getTodayScore(userId, todayDate);
    const total = scoreData?.totalScore || 0;
    const reply = `Your current Daily Life Score is ${total}/100 with a ${scoreData?.streak?.current || 0}-day momentum streak 🔥`;

    await CopilotAuditLog.create({
      user: userId,
      command,
      intent: 'query_score',
      detectedTool: 'query_score',
      status: 'EXECUTED',
      aiProvider: provider,
      actionResponse: reply
    });

    return res.json({
      success: true,
      provider,
      reply: customReply || reply,
      lifeScore: scoreData
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to query life score.' });
  }
}

module.exports = {
  handleCopilotCommand,
  submitStudyTaskQuiz,
  confirmAction
};
