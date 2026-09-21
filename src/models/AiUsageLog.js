const mongoose = require('mongoose');

const aiUsageLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    module: {
      type: String,
      enum: [
        'mock_interview',
        'roadmap',
        'study_plan',
        'quiz',
        'daily_briefing',
        'copilot',
        'code_review',
        'resume_analysis',
        'notes_summarizer',
        'job_matcher',
        'general'
      ],
      required: true,
      index: true
    },
    provider: {
      type: String,
      enum: ['gemini', 'groq', 'openai', 'fallback', 'deterministic'],
      default: 'gemini',
      index: true
    },
    modelName: {
      type: String,
      default: 'gemini-2.5-flash'
    },
    promptTokens: {
      type: Number,
      default: 0
    },
    candidateTokens: {
      type: Number,
      default: 0
    },
    totalTokens: {
      type: Number,
      default: 0
    },
    estimatedCostUsd: {
      type: Number,
      default: 0
    },
    latencyMs: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['success', 'fallback', 'error'],
      default: 'success'
    },
    errorMessage: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

// Compound index for fast time-series aggregation
aiUsageLogSchema.index({ createdAt: -1, module: 1 });
aiUsageLogSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('AiUsageLog', aiUsageLogSchema);
