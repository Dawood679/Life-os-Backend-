const WellnessCheckIn = require('../models/WellnessCheckIn');
const WellnessSettings = require('../models/WellnessSettings');
const Notification = require('../models/Notification');


const todayString = () => new Date().toISOString().split('T')[0];

const getOrCreateSettings = async (userId) => {
  let settings = await WellnessSettings.findOne({ user: userId });
  if (!settings) {
    settings = await WellnessSettings.create({ user: userId });
  }
  return settings;
};

const getOrCreateCheckIn = async (userId, date) => {
  let checkIn = await WellnessCheckIn.findOne({ user: userId, date });
  if (!checkIn) {
    const settings = await getOrCreateSettings(userId);
    checkIn = await WellnessCheckIn.create({
      user: userId,
      date,
      water: { goalMl: settings.waterGoalMl },
      screenTime: { goalMinutes: settings.screenTimeGoalMinutes }
    });
  }
  return checkIn;
};

const withMeta = (checkIn) => {
  const obj = checkIn.toObject();
  return {
    ...obj,
    water: {
      ...obj.water,
      goalMet: obj.water.totalMl >= obj.water.goalMl,
      percent: Math.min(100, Math.round((obj.water.totalMl / obj.water.goalMl) * 100))
    },
    screenTime: {
      ...obj.screenTime,
      overGoal: obj.screenTime.totalMinutes > obj.screenTime.goalMinutes,
      percent: Math.min(100, Math.round((obj.screenTime.totalMinutes / obj.screenTime.goalMinutes) * 100))
    }
  };
};

// log water intake
const logWater = async (req, res) => {
  try {
    const { amountMl, date } = req.body;

    if (!amountMl || amountMl <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid amountMl (e.g. 250 for a glass of water)'
      });
    }

    const targetDate = date || todayString();
    const checkIn = await getOrCreateCheckIn(req.user._id, targetDate);

    checkIn.water.entries.push({ amountMl });
    checkIn.water.totalMl += amountMl;
    await checkIn.save();

    res.status(201).json({
      success: true,
      message: 'Water intake logged',
      checkIn: withMeta(checkIn)
    });
  } catch (error) {
    console.error('Log water error:', error);
    res.status(500).json({ success: false, message: 'Server error logging water intake' });
  }
};

// log screen time
const logScreenTime = async (req, res) => {
  try {
    const { minutes, category, date } = req.body;

    if (!minutes || minutes <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide valid minutes (e.g. 30)'
      });
    }

    const targetDate = date || todayString();
    const checkIn = await getOrCreateCheckIn(req.user._id, targetDate);

    checkIn.screenTime.entries.push({ minutes, category: category || 'general' });
    checkIn.screenTime.totalMinutes += minutes;
    await checkIn.save();

    res.status(201).json({
      success: true,
      message: 'Screen time logged',
      checkIn: withMeta(checkIn)
    });
  } catch (error) {
    console.error('Log screen time error:', error);
    res.status(500).json({ success: false, message: 'Server error logging screen time' });
  }
};

// get today
const getCheckIn = async (req, res) => {
  try {
    const targetDate = req.query.date || todayString();

    let checkIn = await WellnessCheckIn.findOne({ user: req.user._id, date: targetDate });

    if (!checkIn) {
      // Don't persist a doc just for a read — return live defaults from settings
      const settings = await getOrCreateSettings(req.user._id);
      return res.json({
        success: true,
        checkIn: {
          user: req.user._id,
          date: targetDate,
          water: { goalMl: settings.waterGoalMl, totalMl: 0, entries: [], goalMet: false, percent: 0 },
          screenTime: { goalMinutes: settings.screenTimeGoalMinutes, totalMinutes: 0, entries: [], overGoal: false, percent: 0 }
        }
      });
    }

    res.json({ success: true, checkIn: withMeta(checkIn) });
  } catch (error) {
    console.error('Get check-in error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching check-in' });
  }
};

// get history
const getHistory = async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 7, 90);

    const checkIns = await WellnessCheckIn.find({ user: req.user._id })
      .sort({ date: -1 })
      .limit(days);

    const history = checkIns.reverse().map((c) => withMeta(c));

    res.json({ success: true, count: history.length, history });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching history' });
  }
};

// update goals
const updateGoals = async (req, res) => {
  try {
    const { waterGoalMl, screenTimeGoalMinutes } = req.body;

    const settings = await getOrCreateSettings(req.user._id);

    if (waterGoalMl !== undefined) {
      if (waterGoalMl <= 0) {
        return res.status(400).json({ success: false, message: 'waterGoalMl must be greater than 0' });
      }
      settings.waterGoalMl = waterGoalMl;
    }

    if (screenTimeGoalMinutes !== undefined) {
      if (screenTimeGoalMinutes <= 0) {
        return res.status(400).json({ success: false, message: 'screenTimeGoalMinutes must be greater than 0' });
      }
      settings.screenTimeGoalMinutes = screenTimeGoalMinutes;
    }

    await settings.save();

    res.json({ success: true, message: 'Goals updated', settings });
  } catch (error) {
    console.error('Update goals error:', error);
    res.status(500).json({ success: false, message: 'Server error updating goals' });
  }
};

// delete single entry
const deleteEntry = async (req, res) => {
  try {
    const { type, entryId } = req.params; // type: "water" | "screen-time"
    const date = req.query.date || todayString();

    if (!['water', 'screen-time'].includes(type)) {
      return res.status(400).json({ success: false, message: 'type must be "water" or "screen-time"' });
    }

    const checkIn = await WellnessCheckIn.findOne({ user: req.user._id, date });
    if (!checkIn) {
      return res.status(404).json({ success: false, message: 'Check-in not found for this date' });
    }

    if (type === 'water') {
      const entry = checkIn.water.entries.id(entryId);
      if (!entry) return res.status(404).json({ success: false, message: 'Entry not found' });
      checkIn.water.totalMl -= entry.amountMl;
      entry.deleteOne();
    } else {
      const entry = checkIn.screenTime.entries.id(entryId);
      if (!entry) return res.status(404).json({ success: false, message: 'Entry not found' });
      checkIn.screenTime.totalMinutes -= entry.minutes;
      entry.deleteOne();
    }

    await checkIn.save();
    res.json({ success: true, message: 'Entry removed', checkIn: withMeta(checkIn) });
  } catch (error) {
    console.error('Delete entry error:', error);
    res.status(500).json({ success: false, message: 'Server error deleting entry' });
  }
};

// update reminder
const updateReminderSettings = async (req, res) => {
  try {
    const {
      enabled,
      mode,            // "manual" | "auto"
      intervalMinutes, // required if mode === "manual"
      activeStart,      // "HH:mm"
      activeEnd,
      emailEnabled,
      inAppEnabled
    } = req.body;

    const settings = await getOrCreateSettings(req.user._id);

    if (enabled !== undefined) settings.reminder.enabled = enabled;
    if (mode) settings.reminder.mode = mode;
    if (intervalMinutes) settings.reminder.intervalMinutes = intervalMinutes;
    if (activeStart) settings.reminder.activeStart = activeStart;
    if (activeEnd) settings.reminder.activeEnd = activeEnd;
    if (emailEnabled !== undefined) settings.reminder.emailEnabled = emailEnabled;
    if (inAppEnabled !== undefined) settings.reminder.inAppEnabled = inAppEnabled;

    // Reset schedule so the next reminder recalculates from now
    settings.reminder.nextReminderAt = null;

    await settings.save();

    res.json({ success: true, message: 'Reminder settings updated', settings });
  } catch (error) {
    console.error('Update reminder settings error:', error);
    res.status(500).json({ success: false, message: 'Server error updating reminder settings' });
  }
};

// notifications
const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(30);

    const unreadCount = await Notification.countDocuments({ user: req.user._id, read: false });

    res.json({ success: true, unreadCount, notifications });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching notifications' });
  }
};

// mark as read notification
const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, user: req.user._id },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.json({ success: true, notification });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ success: false, message: 'Server error updating notification' });
  }
};

module.exports = {
  logWater,
  logScreenTime,
  getCheckIn,
  getHistory,
  updateGoals,
  deleteEntry,
  updateReminderSettings,
  getNotifications,
  markNotificationRead
};