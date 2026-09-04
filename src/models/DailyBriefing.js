const mongoose = require('mongoose');

const dailyBriefingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    // Local calendar date in user's timezone ('YYYY-MM-DD')
    date: {
      type: String,
      required: true,
      index: true
    },
    // Period: 'morning' (04:00-18:00) | 'evening' (18:00-04:00)
    period: {
      type: String,
      enum: ['morning', 'evening'],
      required: true,
      index: true
    },
    // Personalized Executive Greeting
    greeting: {
      type: String,
      required: true,
      trim: true
    },
    // Concise 2-3 sentence AI narrative / executive briefing
    executiveSummary: {
      type: String,
      required: true,
      trim: true
    },
    // Structured Action Priorities with Direct Deep Links
    priorities: [
      {
        title: { type: String, required: true },
        category: {
          type: String,
          enum: ['career', 'learning', 'health', 'task'],
          default: 'task'
        },
        actionUrl: { type: String, default: '/dashboard' },
        urgency: {
          type: String,
          enum: ['high', 'medium', 'low'],
          default: 'medium'
        }
      }
    ],
    // High-priority Career & Application Alerts
    careerAlerts: [{ type: String, trim: true }],
    // Targeted Study Plan / Skill Gap recommendation
    learningFocus: { type: String, trim: true, default: '' },
    // Actionable hydration / wellness advice
    healthWellnessAdvice: { type: String, trim: true, default: '' },
    // Life score delta suggestion to hit 100/100
    lifeScoreInsight: { type: String, trim: true, default: '' },
    // Dedicated Human Conversational Audio Script
    spokenAudioScript: { type: String, trim: true, default: '' },
    // Curated domain-relevant quote
    motivationalQuote: { type: String, trim: true, default: '' },
    // Deterministic snapshot of facts when generated
    statsSnapshot: {
      compositeScore: { type: Number, default: 0 },
      streakCount: { type: Number, default: 0 },
      streakSecured: { type: Boolean, default: false },
      todosActive: { type: Number, default: 0 },
      todosCompleted: { type: Number, default: 0 },
      interviewsScheduled: { type: Number, default: 0 },
      followUpsDue: { type: Number, default: 0 },
      waterConsumedMl: { type: Number, default: 0 },
      waterTargetMl: { type: Number, default: 2000 },
      sleepHours: { type: Number, default: 0 }
    },
    // Flag if generated via Gemini or Deterministic fallback
    isAiGenerated: {
      type: Boolean,
      default: true
    },
    // Observability & Token Cost Accounting
    tokenUsage: {
      promptTokens: { type: Number, default: 0 },
      responseTokens: { type: Number, default: 0 },
      totalTokens: { type: Number, default: 0 },
      estimatedCostUsd: { type: Number, default: 0 }
    }
  },
  { timestamps: true }
);

// Compound unique index ensuring one immutable cache record per user per local date per period
dailyBriefingSchema.index({ user: 1, date: 1, period: 1 }, { unique: true });

module.exports = mongoose.model('DailyBriefing', dailyBriefingSchema);
