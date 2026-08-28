const mongoose = require('mongoose');
const { Type } = require('@google/genai');

const interviewTurnSchema = new mongoose.Schema(
  {
    questionNumber: { type: Number, required: true },
    questionText: { type: String, required: true },
    category: {
      type: String,
      lowercase: true,
      trim: true,
      default: 'technical'
    },
    userAnswer: { type: String, default: '' },
    feedbackBrief: { type: String, default: '' },
    idealAnswerBullet: { type: String, default: '' },
    score: { type: Number, min: 0, max: 100, default: 0 },
    answeredAt: { type: Date }
  },
  { _id: false }
);

const interviewSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    roleTitle: {
      type: String,
      required: [true, 'Role title is required'],
      trim: true
    },
    experienceLevel: {
      type: String,
      enum: ['entry', 'junior', 'mid', 'senior', 'lead'],
      default: 'mid'
    },
    interviewType: {
      type: String,
      enum: ['mixed', 'technical', 'behavioral', 'system_design'],
      default: 'mixed'
    },
    targetCompanyOrStyle: {
      type: String,
      default: 'Standard Tech / Enterprise',
      trim: true
    },
    jobDescription: {
      type: String,
      trim: true,
      default: ''
    },
    totalQuestions: {
      type: Number,
      default: 5
    },
    currentTurn: {
      type: Number,
      default: 1
    },
    status: {
      type: String,
      enum: ['in_progress', 'completed', 'abandoned'],
      default: 'in_progress'
    },
    turns: [interviewTurnSchema],

    // Comprehensive Post-Interview Diagnostic Evaluation
    scorecard: {
      overallScore: { type: Number, min: 0, max: 100, default: 0 },
      readinessVerdict: {
        type: String,
        default: 'Needs Preparation',
        trim: true
      },
      metrics: {
        technicalAccuracy: { type: Number, min: 0, max: 100, default: 0 },
        communicationClarity: { type: Number, min: 0, max: 100, default: 0 },
        criticalThinking: { type: Number, min: 0, max: 100, default: 0 }
      },
      strengths: [{ type: String }],
      weaknesses: [{ type: String }],
      summaryReview: { type: String, default: '' }
    },

    // Identified Weakness topics directly bridgeable to Study Planner
    weakTopics: [
      {
        topic: { type: String, required: true },
        suggestedSkill: { type: String, default: 'General' },
        severity: {
          type: String,
          lowercase: true,
          trim: true,
          default: 'moderate'
        }
      }
    ],

    linkedStudyPlan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudyPlan'
    },

    usageMetrics: {
      totalPromptTokens: { type: Number, default: 0 },
      totalCandidateTokens: { type: Number, default: 0 },
      estimatedCostUsd: { type: Number, default: 0 }
    },

    completedAt: { type: Date }
  },
  {
    timestamps: true
  }
);

// Gemini Response Schema for Question Generation (Turn-by-turn)
const interviewQuestionResponseSchema = {
  type: Type.OBJECT,
  properties: {
    questionText: { type: Type.STRING },
    category: { type: Type.STRING },
    interviewContext: { type: Type.STRING },
    acknowledgement: { type: Type.STRING }
  },
  required: ['questionText', 'category']
};

// Gemini Response Schema for Final Scorecard Evaluation (Single-call)
const interviewScorecardResponseSchema = {
  type: Type.OBJECT,
  properties: {
    overallScore: { type: Type.NUMBER },
    readinessVerdict: { type: Type.STRING },
    metrics: {
      type: Type.OBJECT,
      properties: {
        technicalAccuracy: { type: Type.NUMBER },
        communicationClarity: { type: Type.NUMBER },
        criticalThinking: { type: Type.NUMBER }
      },
      required: ['technicalAccuracy', 'communicationClarity', 'criticalThinking']
    },
    strengths: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    weaknesses: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    summaryReview: { type: Type.STRING },
    weakTopics: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          topic: { type: Type.STRING },
          suggestedSkill: { type: Type.STRING },
          severity: { type: Type.STRING }
        },
        required: ['topic', 'suggestedSkill', 'severity']
      }
    },
    turnsFeedback: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          questionNumber: { type: Type.NUMBER },
          feedbackBrief: { type: Type.STRING },
          idealAnswerBullet: { type: Type.STRING },
          score: { type: Type.NUMBER }
        },
        required: ['questionNumber', 'feedbackBrief', 'idealAnswerBullet', 'score']
      }
    }
  },
  required: ['overallScore', 'readinessVerdict', 'metrics', 'strengths', 'weaknesses', 'summaryReview', 'weakTopics', 'turnsFeedback']
};

const InterviewSession = mongoose.model('InterviewSession', interviewSessionSchema);

module.exports = {
  InterviewSession,
  interviewQuestionResponseSchema,
  interviewScorecardResponseSchema
};
