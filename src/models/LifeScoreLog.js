const mongoose = require('mongoose');

const lifeScoreLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    date: {
      type: String, // "YYYY-MM-DD"
      required: true,
      index: true
    },
    totalScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 0
    },
    healthScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 0
    },
    learningScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 0
    },
    careerScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 0
    },
    focusMode: {
      type: String,
      enum: ['balanced', 'career_sprint', 'student_exam', 'custom'],
      default: 'balanced'
    },
    weights: {
      health: { type: Number, default: 0.35 },
      learning: { type: Number, default: 0.40 },
      career: { type: Number, default: 0.25 }
    },
    breakdown: {
      waterConsumedMl: { type: Number, default: 0 },
      waterTargetMl: { type: Number, default: 2000 },
      sleepHours: { type: Number, default: 0 },
      moodScore: { type: Number, default: 0 },
      quizzesCompleted: { type: Number, default: 0 },
      quizAvgPercentage: { type: Number, default: 0 },
      studyTasksCompleted: { type: Number, default: 0 },
      todosCompleted: { type: Number, default: 0 },
      todosTotal: { type: Number, default: 0 }
    },
    insights: [{ type: String }]
  },
  { timestamps: true }
);

// Compound unique index ensuring one immutable log per user per day
lifeScoreLogSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('LifeScoreLog', lifeScoreLogSchema);
