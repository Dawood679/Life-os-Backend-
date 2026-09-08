const cron = require('node-cron');
const User = require('../models/User');
const Notification = require('../models/Notification');
const sendEmail = require('../config/email'); // Importing your existing email config

// Helper function to get current hour (0-23) in a specific timezone using Native JS
const getCurrentHourInTimezone = (timezone) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hourCycle: 'h23' // Forces 0-23 hour format
  });
  return parseInt(formatter.format(new Date()), 10);
};

const initWaterReminderCron = () => {
  // Runs exactly at minute 0 of every hour (e.g., 08:00, 09:00, 10:00)
  cron.schedule('0 * * * *', async () => {
    console.log('[CRON] Starting water reminder check...');

    try {
      // Fetch only users who opted in for water tracking
      const users = await User.find({ 'waterSettings.isActive': true });

      for (const user of users) {
        if (!user.timezone) continue; // Skip if timezone is completely missing

        try {
          // Get user's current local hour natively
          const currentLocalHour = getCurrentHourInTimezone(user.timezone);

          // Parse sleep and wake hours (e.g., "08:00" -> 8)
          const wakeHour = parseInt(user.waterSettings.wakeTime.split(':')[0], 10);
          const sleepHour = parseInt(user.waterSettings.sleepTime.split(':')[0], 10);
          const interval = user.waterSettings.intervalHours || 2;

          // Determine if user is currently in their waking window
          const isAwake = currentLocalHour >= wakeHour && currentLocalHour < sleepHour;

          // Determine if it's the correct interval hour to alert
          const isTimeForAlert = (currentLocalHour - wakeHour) % interval === 0;

          if (isAwake && isTimeForAlert) {
            
            // 1. Create In-App Notification (Database)
            await Notification.create({
              user: user._id,
              title: 'Time to Hydrate! 💧',
              message: 'Stay energized. Grab a glass of water and log your progress!',
              type: 'water_reminder',
              read: false
            });

            // 2. Fire Email Alert using your existing mailer
            if (user.waterSettings.isEmailAlertEnabled && user.email) {
              await sendEmail({
                to: user.email,
                subject: 'LifeOS: Time to Hydrate! 💧',
                html: `
                  <div style="font-family: Arial, sans-serif; color: #333; max-width: 500px; margin: auto;">
                    <h2>Time to Hydrate! 💧</h2>
                    <p>Stay energized. Grab a glass of water and log your progress in <b>LifeOS</b>!</p>
                    <p>Consistency is key to maintaining your Energy Score.</p>
                  </div>
                `
              });
            }
          }
        } catch (tzError) {
          console.error(`[CRON ERROR] Timezone calculation failed for user ${user._id}:`, tzError.message);
        }
      }
    } catch (error) {
      console.error('[CRON ERROR] Failed to fetch users:', error.message);
    }
  });
};

module.exports = initWaterReminderCron;