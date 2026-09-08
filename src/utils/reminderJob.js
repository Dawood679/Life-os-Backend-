const cron = require("node-cron");
const Todo = require("../models/Todo");
const User = require("../models/User");
const Notification = require("../models/Notification");
const sendEmail = require("../config/email");

const startReminderJob = () => {
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();

      // Find pending tasks whose reminderTime (or dueDate) has arrived
      const todos = await Todo.find({
        reminderSent: false,
        isCompleted: false,
        $or: [
          { reminderTime: { $lte: now } },
          { reminderTime: null, dueDate: { $lte: now } }
        ]
      });

      if (todos.length > 0) {
        console.log(`[Reminder Job] ${todos.length} task reminders triggered at ${now.toISOString()}`);
      }

      for (const todo of todos) {
        const user = await User.findById(todo.user);
        if (!user) continue;

        const channel = todo.notificationChannel || 'in_app';
        const formattedDueTime = new Date(todo.dueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // 1. IN-APP NOTIFICATION BELL DISPATCH
        if (channel === 'in_app' || channel === 'both') {
          await Notification.create({
            user: todo.user,
            type: 'todo_reminder',
            title: `⏰ Task Reminder: ${todo.title}`,
            message: `Scheduled for ${formattedDueTime}${todo.repeat && todo.repeat !== 'none' ? ` (${todo.repeat})` : ''} • Priority: ${todo.priority.toUpperCase()}`
          });
        }

        // 2. EMAIL NOTIFICATION DISPATCH (Only if email or both requested)
        if (channel === 'email' || channel === 'both') {
          try {
            await sendEmail({
              to: user.email,
              subject: `⏰ LIFEOS Reminder: ${todo.title}`,
              html: `
                <h2>⏰ Task Reminder</h2>
                <p>Hi <strong>${user.name}</strong>,</p>
                <p>This is your scheduled reminder for:</p>
                <div style="background: #f8fafc; padding: 16px; border-radius: 12px; border: 1px solid #e2e8f0; margin: 16px 0;">
                  <h3 style="color: #4f46e5; margin: 0 0 8px">${todo.title}</h3>
                  ${todo.description ? `<p style="color: #64748b; margin: 0 0 8px">${todo.description}</p>` : ''}
                  <p style="margin: 0; font-size: 13px;">Priority: <strong style="color: #e11d48">${todo.priority.toUpperCase()}</strong></p>
                  <p style="margin: 4px 0 0; font-size: 13px;">Scheduled Time: <strong>${formattedDueTime}</strong></p>
                  ${todo.repeat && todo.repeat !== 'none' ? `<p style="margin: 4px 0 0; font-size: 13px;">Frequency: <strong>${todo.repeat}</strong></p>` : ''}
                </div>
                <p>Have a productive session!</p>
              `
            });
          } catch (emailErr) {
            console.error(`Email delivery failed for todo ${todo._id}:`, emailErr.message);
          }
        }

        // 3. RECURRENCE ROLLING OR ONE-TIME COMPLETION
        if (todo.repeat === 'daily') {
          const nextDue = new Date(todo.dueDate);
          nextDue.setDate(nextDue.getDate() + 1);
          const offset = todo.reminderMinutesBefore || 10;
          const nextReminder = new Date(nextDue.getTime() - offset * 60 * 1000);

          await Todo.findByIdAndUpdate(todo._id, {
            dueDate: nextDue,
            reminderTime: nextReminder,
            reminderSent: false
          });
        } else if (todo.repeat === 'weekdays') {
          const nextDue = new Date(todo.dueDate);
          nextDue.setDate(nextDue.getDate() + 1);
          // If Saturday (6), skip to Monday (+2 days)
          if (nextDue.getDay() === 6) nextDue.setDate(nextDue.getDate() + 2);
          // If Sunday (0), skip to Monday (+1 day)
          if (nextDue.getDay() === 0) nextDue.setDate(nextDue.getDate() + 1);

          const offset = todo.reminderMinutesBefore || 10;
          const nextReminder = new Date(nextDue.getTime() - offset * 60 * 1000);

          await Todo.findByIdAndUpdate(todo._id, {
            dueDate: nextDue,
            reminderTime: nextReminder,
            reminderSent: false
          });
        } else if (todo.repeat === 'weekly') {
          const nextDue = new Date(todo.dueDate);
          nextDue.setDate(nextDue.getDate() + 7);
          const offset = todo.reminderMinutesBefore || 10;
          const nextReminder = new Date(nextDue.getTime() - offset * 60 * 1000);

          await Todo.findByIdAndUpdate(todo._id, {
            dueDate: nextDue,
            reminderTime: nextReminder,
            reminderSent: false
          });
        } else if (todo.repeat === 'custom' && Array.isArray(todo.customDays) && todo.customDays.length > 0) {
          const nextDue = new Date(todo.dueDate);
          const currentDay = nextDue.getDay();
          let daysToAdd = 1;
          while (daysToAdd <= 7) {
            const checkDay = (currentDay + daysToAdd) % 7;
            if (todo.customDays.includes(checkDay)) {
              break;
            }
            daysToAdd++;
          }
          nextDue.setDate(nextDue.getDate() + daysToAdd);
          const offset = todo.reminderMinutesBefore || 10;
          const nextReminder = new Date(nextDue.getTime() - offset * 60 * 1000);

          await Todo.findByIdAndUpdate(todo._id, {
            dueDate: nextDue,
            reminderTime: nextReminder,
            reminderSent: false
          });
        } else {
          // One-time task reminder sent
          await Todo.findByIdAndUpdate(todo._id, { reminderSent: true });
        }
      }
    } catch (error) {
      console.error("Reminder job execution error:", error);
    }
  });

  console.log("Unified Multi-Channel Task Reminder Job Started");
};

module.exports = startReminderJob;
