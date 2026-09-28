const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
const connectDB = require("./src/config/db");
const startReminderJob = require("./src/utils/reminderJob");
const { writeLimiter } = require('./src/middleware/rateLimiter');
const initWaterReminderCron = require("./src/utils/waterReminderCron");
const { startHealthSchedulers } = require("./src/utils/healthScheduler");

dotenv.config();

const app = express();

// Only run persistent background cron workers in dedicated Node process (not serverless)
if (!process.env.VERCEL) {
  connectDB();
  startReminderJob();
  initWaterReminderCron();
  startHealthSchedulers();
}

// Auto-connect DB middleware for serverless invocations
app.use(async (req, res, next) => {
  try {
    await connectDB();
  } catch (err) {
    console.error("DB connection error:", err.message);
  }
  next();
});

const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'http://localhost:3000'
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/api', writeLimiter);

app.use("/api/auth", require("./src/routes/authRoutes"));
app.use("/api/admin", require("./src/routes/adminRoutes"));
app.use("/api/profile", require("./src/routes/profileRoutes"));
app.use("/api/to-dos", require("./src/routes/todoRoutes"));
app.use('/api/roadmap', require('./src/routes/roadmapRoutes'));
app.use('/api/study-plan', require('./src/routes/studyPlanRoutes'));
app.use('/api/quiz', require('./src/routes/quizRoutes'));
app.use('/api/chat', require('./src/routes/chatRoutes'));
app.use('/api/code-review', require('./src/routes/codeReviewRoutes'));
app.use('/api/project-generator', require('./src/routes/projectGeneratorRoutes'));
app.use('/api/notes-summarizer', require('./src/routes/notesSummarizerRoutes'));
app.use('/api/job-match', require('./src/routes/jobMatchRoutes'));
app.use('/api/resume', require('./src/routes/resumeRoutes'));
app.use('/api/wellness', require('./src/routes/wellnessRoutes'));
app.use('/api/health', require('./src/routes/healthRoutes'));
app.use('/api/life-score', require('./src/routes/lifeScoreRoutes'));
app.use('/api/onboarding', require('./src/routes/onboardingRoutes'));
app.use('/api/interview', require('./src/routes/interviewRoutes'));
app.use('/api/job-applications', require('./src/routes/jobApplicationRoutes'));
app.use('/api/daily-briefing', require('./src/routes/dailyBriefingRoutes'));
app.use('/api/rescheduler', require('./src/routes/reschedulerRoutes'));

app.use('/api/notifications', require('./src/routes/notificationRoutes'));
app.use('/api/copilot', require('./src/routes/copilotRoutes'));
app.use('/api/weekly-report', require('./src/routes/weeklyReportRoutes'));
app.use('/api/finance', require('./src/routes/financeRoutes'));
app.use('/api/payments', require('./src/routes/paymentRoutes'));
app.use('/api/system', require('./src/routes/systemRoutes'));


app.get("/", (req, res) => {
  res.json({ message: "LIFEOS API is running" });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Something went wrong",
  });
});

const PORT = process.env.PORT || 5000;
if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
