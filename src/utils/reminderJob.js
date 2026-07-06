const cron = require("node-cron");
const Todo = require("../models/Todo");
const User = require("../models/User");
const sendEmail = require("../config/email");

const startReminderJob = () => {
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
      const oneMinuteLater = new Date(now.getTime() + 60 * 1000);

      const todos = await Todo.find({
        reminderSent: false,
        isCompleted: false,
        dueDate: {
          $gte: oneMinuteAgo,
          $lte: oneMinuteLater,
        },
      });

      console.log(`Reminder check: ${todos.length} todos found`);

      for (const todo of todos) {
        const user = await User.findById(todo.user);

        if (!user) continue;

        await sendEmail({
          to: user.email,
          subject: `LIFEOS Reminder: ${todo.title}`,
          html: `
            <h2>⏰ Todo Reminder</h2>
            <p>Hi <strong>${user.name}</strong>,</p>
            <p>This is a reminder for your todo —</p>
            <div style="
              background: #f0f0f0;
              padding: 16px;
              border-radius: 8px;
              margin: 16px 0;
            ">
              <h3 style="color: #6366f1; margin: 0 0 8px">
                ${todo.title}
              </h3>
              ${
                todo.description
                  ? `<p style="color: #666; margin: 0 0 8px">
                    ${todo.description}
                  </p>`
                  : ""
              }
              <p style="margin: 0">
                Priority: <strong>${todo.priority.toUpperCase()}</strong>
              </p>
              <p style="margin: 4px 0 0">
                Scheduled: <strong>
                  ${new Date(todo.dueDate).toLocaleString()}
                </strong>
              </p>
            </div>
            <p>Good luck!</p>
          `,
        });

        todo.reminderSent = true;
        await todo.save();

        console.log(`Reminder sent to ${user.email} for todo: ${todo.title}`);
      }
    } catch (error) {
      console.error("Reminder job error:", error);
    }
  });

  console.log("Reminder job started");
};

module.exports = startReminderJob;
