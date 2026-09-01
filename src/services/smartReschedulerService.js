const WellnessLog = require('../models/WellnessLog');
const Todo = require('../models/Todo');
const LifeScoreLog = require('../models/LifeScoreLog');
const lifeScoreService = require('./lifeScoreService');

/**
 * Helper: Format Date object or Date string to 'YYYY-MM-DD' in user timezone
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
 * Evaluates whether today's health metrics meet the Burnout/Exhaustion Risk Truth Table:
 * - Case 1 (Severe Physical Sleep Dip): sleep < 5.5h OR (sleep < 6.5h AND quality === 'poor')
 * - Case 2 (Combined Sleep + Mood Dip): sleep < 6.5h AND mood.value <= 2 (Bad/Awful)
 * - Case 3 (Chronic Mood Strain): mood.value <= 2 for 2 consecutive days (Yesterday + Today)
 * - Case 4 (Single-day Bad mood with good sleep >= 6.5h): Zero trigger (Normal variance)
 */
const evaluateHealthDeficit = async (userId, userTimezone = 'Asia/Dhaka') => {
  const todayStr = getFormattedLocalDate(new Date(), userTimezone);
  
  // Calculate yesterday's date in user timezone
  const now = new Date();
  const yesterdayObj = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = getFormattedLocalDate(yesterdayObj, userTimezone);

  const [todayLog, yesterdayLog] = await Promise.all([
    WellnessLog.findOne({ user: userId, date: todayStr }),
    WellnessLog.findOne({ user: userId, date: yesterdayStr })
  ]);

  if (!todayLog) {
    return {
      hasDeficit: false,
      reason: null,
      todayLog: null
    };
  }

  const sleepHours = todayLog.sleep?.hours;
  const sleepQuality = todayLog.sleep?.quality;
  const todayMood = todayLog.mood?.value;
  const yesterdayMood = yesterdayLog?.mood?.value;

  // Case 1: Severe Physical Sleep Deficit
  const isSevereSleepDip = typeof sleepHours === 'number' && sleepHours > 0 && (
    sleepHours < 5.5 || (sleepHours < 6.5 && sleepQuality === 'poor')
  );

  // Case 2: Combined Sleep + Mood Dip
  const isCombinedDip = typeof sleepHours === 'number' && sleepHours > 0 && sleepHours < 6.5 && typeof todayMood === 'number' && todayMood <= 2;

  // Case 3: Chronic Mood Strain (Consecutive 2+ Days)
  const isChronicMoodDip = typeof todayMood === 'number' && todayMood <= 2 && typeof yesterdayMood === 'number' && yesterdayMood <= 2;

  let hasDeficit = false;
  let reason = null;
  let severity = 'none';

  if (isSevereSleepDip) {
    hasDeficit = true;
    severity = 'high';
    reason = sleepHours < 5.5
      ? `Short sleep recorded (${sleepHours}h)`
      : `Restless sleep (${sleepHours}h, poor quality)`;
  } else if (isCombinedDip) {
    hasDeficit = true;
    severity = 'high';
    reason = `Low sleep (${sleepHours}h) combined with feeling strained`;
  } else if (isChronicMoodDip) {
    hasDeficit = true;
    severity = 'medium';
    reason = 'Extended emotional fatigue (consecutive low mood logged)';
  }

  return {
    hasDeficit,
    reason,
    severity,
    todayLog: {
      date: todayStr,
      sleepHours,
      sleepQuality,
      mood: todayMood,
      energyScore: todayLog.energyScore
    }
  };
};

/**
 * Generates the Human EA Proposal: analyzes active todos and categorizes into
 * Protected Today (urgent) vs Deferrable (medium/low).
 */
const getProposalDetails = async (userId, userTimezone = 'Asia/Dhaka') => {
  const todayStr = getFormattedLocalDate(new Date(), userTimezone);
  const evaluation = await evaluateHealthDeficit(userId, userTimezone);

  // Check if today already has active recovery mode applied on LifeScoreLog
  const todayScoreLog = await LifeScoreLog.findOne({ user: userId, date: todayStr });
  const isRecoveryActive = Boolean(todayScoreLog?.breakdown?.recoveryMode);
  const activeBatchSnapshot = todayScoreLog?.breakdown?.recoveryBatchSnapshot || null;

  if (!evaluation.hasDeficit && !isRecoveryActive) {
    return {
      triggered: false,
      isRecoveryActive: false,
      evaluation,
      protectedTasks: [],
      deferrableTasks: []
    };
  }

  // Fetch active todos due today or earlier
  const allUserTodos = await Todo.find({ user: userId, isCompleted: false });
  const todaysActiveTodos = allUserTodos.filter(t => {
    if (!t.dueDate) return true;
    const taskDateStr = getFormattedLocalDate(t.dueDate, userTimezone);
    return taskDateStr <= todayStr;
  });

  const protectedTasks = todaysActiveTodos.filter(t => t.priority === 'urgent' || t.priority === 'high');
  const deferrableTasks = todaysActiveTodos.filter(t => t.priority === 'medium' || t.priority === 'low');

  return {
    triggered: evaluation.hasDeficit,
    isRecoveryActive,
    canUndo: isRecoveryActive && Boolean(activeBatchSnapshot?.items?.length),
    evaluation,
    proposalText: `I noticed you logged ${evaluation.reason || 'low energy today'}. Would you like me to lighten today's load by deferring ${deferrableTasks.length} non-urgent tasks to tomorrow so you can recharge?`,
    protectedTasks,
    deferrableTasks
  };
};

/**
 * Executes 1-Click Recovery Deferral: Batch pushes deferrable todos to tomorrow
 * and records a snapshot on LifeScoreLog for deterministic rollback.
 */
const executeRecovery = async (userId, userTimezone = 'Asia/Dhaka') => {
  const todayStr = getFormattedLocalDate(new Date(), userTimezone);
  
  // Calculate tomorrow's local date
  const now = new Date();
  const tomorrowObj = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowStr = getFormattedLocalDate(tomorrowObj, userTimezone);

  // Fetch all active deferrable todos due today or earlier
  const allUserTodos = await Todo.find({ user: userId, isCompleted: false });
  const deferrableTodos = allUserTodos.filter(t => {
    if (t.priority === 'urgent' || t.priority === 'high') return false;
    if (!t.dueDate) return true;
    const taskDateStr = getFormattedLocalDate(t.dueDate, userTimezone);
    return taskDateStr <= todayStr;
  });

  const batchId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const snapshotItems = [];

  // Batch update due dates to tomorrow
  for (const todo of deferrableTodos) {
    snapshotItems.push({
      todoId: todo._id,
      title: todo.title,
      originalDueDate: todo.dueDate || new Date()
    });

    todo.dueDate = new Date(tomorrowStr);
    await todo.save();
  }

  // Update or create LifeScoreLog with recoveryMode and snapshot
  let scoreLog = await LifeScoreLog.findOne({ user: userId, date: todayStr });
  if (!scoreLog) {
    await lifeScoreService.calculateDailyScore(userId, new Date());
    scoreLog = await LifeScoreLog.findOne({ user: userId, date: todayStr });
  }

  if (scoreLog) {
    if (!scoreLog.breakdown) scoreLog.breakdown = {};
    scoreLog.breakdown.recoveryMode = true;
    scoreLog.breakdown.recoveryBatchSnapshot = {
      batchId,
      timestamp: new Date(),
      items: snapshotItems
    };
    scoreLog.markModified('breakdown');
    await scoreLog.save();
  }

  return {
    success: true,
    batchId,
    deferredCount: snapshotItems.length,
    tomorrowDate: tomorrowStr
  };
};

/**
 * 1-Click Rollback / Undo: Restores all deferred tasks to their exact originalDueDate.
 */
const undoRecovery = async (userId, userTimezone = 'Asia/Dhaka') => {
  const todayStr = getFormattedLocalDate(new Date(), userTimezone);
  const scoreLog = await LifeScoreLog.findOne({ user: userId, date: todayStr });

  const snapshot = scoreLog?.breakdown?.recoveryBatchSnapshot;
  if (!snapshot || !Array.isArray(snapshot.items) || snapshot.items.length === 0) {
    throw new Error('No active recovery snapshot found to undo.');
  }

  let restoredCount = 0;
  for (const item of snapshot.items) {
    const todo = await Todo.findById(item.todoId);
    if (todo && !todo.isCompleted) {
      todo.dueDate = item.originalDueDate ? new Date(item.originalDueDate) : new Date(todayStr);
      await todo.save();
      restoredCount++;
    }
  }

  // Deactivate recoveryMode on LifeScoreLog
  scoreLog.breakdown.recoveryMode = false;
  scoreLog.breakdown.recoveryBatchSnapshot = null;
  scoreLog.markModified('breakdown');
  await scoreLog.save();

  return {
    success: true,
    restoredCount
  };
};

module.exports = {
  evaluateHealthDeficit,
  getProposalDetails,
  executeRecovery,
  undoRecovery,
  getFormattedLocalDate
};
