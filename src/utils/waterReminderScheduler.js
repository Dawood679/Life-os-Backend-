const cron = require('node-cron');
const WellnessSettings = require('../models/WellnessSettings');
const WellnessCheckIn = require('../models/WellnessCheckIn');
const Notification = require('../models/Notification');
const User = require('../models/User');
const sendEmail = require('./sendEmail'); 

const todayString = () => new Date().toISOString().split('T')[0];

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

const isWithinActiveWindow = (settings) => {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const start = toMinutes(settings.reminder.activeStart);
  const end = toMinutes(settings.reminder.activeEnd);
  return nowMinutes >= start && nowMinutes <= end;
};

const calculateAutoInterval = (settings) => {
  const start = toMinutes(settings.reminder.activeStart);
  const end = toMinutes(settings.reminder.activeEnd);
  const activeMinutes = Math.max(end - start, 60);

  const glassSizeMl = 250;
  const glassesNeeded = Math.max(Math.ceil(settings.waterGoalMl / glassSizeMl), 1);

  return Math.max(Math.round(activeMinutes / glassesNeeded), 15);
};

// email template
const buildWaterReminderHtml = ({ name, totalMl, goalMl }) => {
  const remainingMl = Math.max(goalMl - totalMl, 0);

  return `
    <div style="font-family: sans-serif; padding: 16px;">
      <h2>Hey ${name || 'there'}, hydration check-in! 💧</h2>
      <p>You've had <strong>${totalMl}ml</strong> out of your <strong>${goalMl}ml</strong> daily goal.</p>
      <p>${
        remainingMl > 0
          ? `Just ${remainingMl}ml more to go — grab a glass now!`
          : "You've already hit your goal today. Great job!"
      }</p>
    </div>
  `;
};

const sendReminderToUser = async (settings) => {
  const user = await User.findById(settings.user);
  if (!user) return;

  const checkIn = await WellnessCheckIn.findOne({ user: settings.user, date: todayString() });
  const totalMl = checkIn?.water?.totalMl || 0;

  // Already hit today's goal — no need to keep pinging
  if (totalMl >= settings.waterGoalMl) return;

  if (settings.reminder.inAppEnabled) {
    await Notification.create({
      user: settings.user,
      type: 'water-reminder',
      title: '💧 Time to drink water',
      message: `You're at ${totalMl}ml of your ${settings.waterGoalMl}ml goal today.`
    });
  }

  if (settings.reminder.emailEnabled && user.email) {
    try {
      await sendEmail({
        to: user.email,
        subject: '💧 Time to drink some water!',
        html: buildWaterReminderHtml({ name: user.name, totalMl, goalMl: settings.waterGoalMl })
      });
    } catch (err) {
      console.error(`Failed to send water reminder email to ${user.email}:`, err.message);
    }
  }
};

// Runs every minute, picks up anyone whose nextReminderAt has passed
const startWaterReminderScheduler = () => {
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();

      const dueSettings = await WellnessSettings.find({
        'reminder.enabled': true,
        $or: [
          { 'reminder.nextReminderAt': { $lte: now } },
          { 'reminder.nextReminderAt': null }
        ]
      });

      for (const settings of dueSettings) {
        if (!isWithinActiveWindow(settings)) continue;

        await sendReminderToUser(settings);

        const intervalMinutes =
          settings.reminder.mode === 'auto'
            ? calculateAutoInterval(settings)
            : settings.reminder.intervalMinutes;

        settings.reminder.lastReminderSentAt = now;
        settings.reminder.nextReminderAt = new Date(now.getTime() + intervalMinutes * 60 * 1000);
        await settings.save();
      }
    } catch (err) {
      console.error('Water reminder scheduler error:', err);
    }
  });

  console.log('💧 Water reminder scheduler started (checks every minute)');
};

module.exports = { startWaterReminderScheduler };