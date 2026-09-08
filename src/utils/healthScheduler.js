const cron = require('node-cron');
const Medicine = require('../models/Medicine');
const Appointment = require('../models/Appointment');
const Notification = require('../models/Notification');
const User = require('../models/User');
// const sendEmail = require('./sendEmail');

const startHealthSchedulers = () => {
  cron.schedule('* * * * *', async () => {
    try {
      const serverNow = new Date();
      const tzString = serverNow.toLocaleString('en-US', { timeZone: 'Asia/Dhaka' });
      const localNow = new Date(tzString);
      
      // 1. Safely derive local HH:mm
      const currentHour = String(localNow.getHours()).padStart(2, '0');
      const currentMinute = String(localNow.getMinutes()).padStart(2, '0');
      const currentTime = `${currentHour}:${currentMinute}`;
      
      // 2. Safely derive local YYYY-MM-DD
      const year = localNow.getFullYear();
      const month = String(localNow.getMonth() + 1).padStart(2, '0');
      const day = String(localNow.getDate()).padStart(2, '0');
      const currentDateString = `${year}-${month}-${day}`;
      
      // 3. Safely derive local Day Name
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const currentDayName = days[localNow.getDay()];

      console.log(`[Health Cron] Checking Alarms | Time: ${currentTime} | Date: ${currentDateString} | Day: ${currentDayName}`);

      // PROCESS MEDICINE NOTIFICATIONS
      const activeMedicines = await Medicine.find({ 
        isActive: true, 
        'reminder.enabled': true,
        times: currentTime 
      });

      for (const med of activeMedicines) {
        if (currentDateString < med.startDate || currentDateString > med.endDate) {
            continue; // Out of date range
        }

        let shouldNotify = false;

        if (med.reminder.type === 'everyday') {
          shouldNotify = true;
        } else if (med.reminder.type === 'specific_days' && med.reminder.days.includes(currentDayName)) {
          shouldNotify = true;
        } else if (med.reminder.type === 'specific_dates' && med.reminder.dates.includes(currentDateString)) {
          shouldNotify = true;
        }

        if (shouldNotify) {
          await Notification.create({
            user: med.user,
            type: 'medicine_reminder',
            title: `💊 Medicine Reminder: ${med.name}`,
            message: `Please take your dose (${med.dosage}). Scheduled for ${currentTime}.`
          });
          console.log(`[Health Cron] ✅ Notification created for ${med.name}!`);
        }
      }

      // PROCESS APPOINTMENT NOTIFICATIONS (24hrs before)
      const tomorrow = new Date(localNow.getTime() + 24 * 60 * 60 * 1000);
      const upcomingAppointments = await Appointment.find({
        status: 'upcoming',
        'reminder.isNotified': false,
        appointmentDate: { $lte: tomorrow.toISOString() }
      }).populate('user', 'name email');

      for (const appt of upcomingAppointments) {
        if (appt.reminder.inApp) {
          await Notification.create({
            user: appt.user._id,
            type: 'system',
            title: `🩺 Upcoming Appointment Alert`,
            message: `You have an appointment with ${appt.doctorName} within the next 24 hours.`
          });
        }
        
        // Uncomment when email is fully configured
        // if (appt.reminder.email && appt.user.email) {
        //   await sendEmail({...});
        // }

        appt.reminder.isNotified = true;
        await appt.save();
        console.log(`[Health Cron] ✅ Appointment alert created for ${appt.doctorName}!`);
      }

    } catch (err) {
      console.error('Health Scheduler Error:', err);
    }
  });

  console.log('🕒 Health Cron Schedulers (Medicine & Appointments) started.');
};

module.exports = { startHealthSchedulers };