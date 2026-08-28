const mongoose = require('mongoose');
const { Type } = require('@google/genai');

const microQuizQuestionSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    options: [{ type: String, required: true }],
    correctAnswer: { type: String, required: true }, // "A", "B", "C", or "D"
    explanation: { type: String }
  },
  { _id: false }
);

const studyTaskSchema = new mongoose.Schema(
  {
    taskNumber: { type: Number, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    tier: {
      type: String,
      enum: ['quick_concept', 'core_mechanism', 'hands_on_exercise'],
      default: 'core_mechanism'
    },
    estimatedMinutes: { type: Number, default: 30 },
    points: { type: Number, default: 20 },
    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date },
    microQuiz: [microQuizQuestionSchema]
  },
  { _id: false }
);

const studyPlanSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    subject: { type: String, required: true },
    currentLevel: { type: String, default: 'beginner' },

    // AI Generated Output Fields
    planTitle: { type: String, required: true },
    summary: { type: String },
    canonicalSkill: { type: String, default: 'General' },
    isSkillVerifiable: { type: Boolean, default: true },

    // Granular Task List (Replacing Day 1/Day 2 rigid blocks)
    tasks: [studyTaskSchema],

    totalPoints: { type: Number, default: 100 },
    earnedPoints: { type: Number, default: 0 },
    completionPercentage: { type: Number, default: 0 },

    tips: [{ type: String }],
    sourceRoadmap: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Roadmap'
    },
    rawResponse: { type: String },
    generatedAt: { type: Date, default: Date.now },

    // Backward compatibility for legacy 7-day plans
    dailyPlan: [
      {
        day: { type: Number },
        topic: { type: String },
        tasks: [{ type: String }]
      }
    ]
  },
  { timestamps: true }
);

// Gemini Structured Output Schema for Study Plan Generator
const studyPlanResponseSchema = {
  type: Type.OBJECT,
  properties: {
    planTitle: { type: Type.STRING },
    summary: { type: Type.STRING },
    canonicalSkill: { type: Type.STRING },
    isSkillVerifiable: { type: Type.BOOLEAN },
    tasks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          taskNumber: { type: Type.INTEGER },
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          tier: {
            type: Type.STRING,
            enum: ['quick_concept', 'core_mechanism', 'hands_on_exercise']
          },
          estimatedMinutes: { type: Type.INTEGER },
          points: { type: Type.INTEGER },
          microQuiz: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                correctAnswer: { type: Type.STRING },
                explanation: { type: Type.STRING }
              },
              required: ['question', 'options', 'correctAnswer', 'explanation']
            }
          }
        },
        required: ['taskNumber', 'title', 'description', 'tier', 'estimatedMinutes', 'points', 'microQuiz']
      }
    },
    tips: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    }
  },
  required: ['planTitle', 'summary', 'canonicalSkill', 'isSkillVerifiable', 'tasks', 'tips']
};

const StudyPlan = mongoose.model('StudyPlan', studyPlanSchema);
StudyPlan.StudyPlan = StudyPlan;
StudyPlan.studyPlanResponseSchema = studyPlanResponseSchema;

module.exports = StudyPlan;
module.exports.StudyPlan = StudyPlan;
module.exports.studyPlanResponseSchema = studyPlanResponseSchema;