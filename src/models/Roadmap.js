const mongoose = require('mongoose');
const { Type } = require('@google/genai');

const milestoneSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  estimatedWeeks: { type: Number, default: 1 },
  category: {
    type: String,
    default: 'general'
  },
  actionBridge: {
    studyTopic: { type: String },
    interviewTopic: { type: String },
    quizTopic: { type: String },
    capstoneTitle: { type: String }
  },
  resources: [{ type: String }],
  isCompleted: { type: Boolean, default: false },
  isBridgedToTodo: { type: Boolean, default: false },
  completedAt: { type: Date }
});

const phaseSchema = new mongoose.Schema({
  phaseNumber: { type: Number, required: true },
  phaseTitle: { type: String, required: true },
  phaseFocus: { type: String }, // e.g. "Month 1: Foundation & Skill Gaps"
  milestones: [milestoneSchema]
});

const roadmapSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    goal: { type: String, required: true },
    title: { type: String, required: true },
    duration: { type: String, default: '90 Days (3 Months)' },
    phases: [phaseSchema],
    rawResponse: { type: String },
    generatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

const Roadmap = mongoose.model('Roadmap', roadmapSchema);

Roadmap.cleanIndexes().catch((err) => {
  console.log('Index cleanup note:', err.message);
});

// Gemini schemas for 90-Day Connected Transformation Roadmap
const roadmapResponseSchema = {
  type: Type.OBJECT,
  properties: {
    roadmapTitle: { type: Type.STRING },
    duration: { type: Type.STRING },
    phases: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          phaseNumber: { type: Type.INTEGER },
          phaseTitle: { type: Type.STRING },
          phaseFocus: { type: Type.STRING },
          milestones: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                estimatedWeeks: { type: Type.INTEGER },
                category: { type: Type.STRING },
                actionBridge: {
                  type: Type.OBJECT,
                  properties: {
                    studyTopic: { type: Type.STRING },
                    interviewTopic: { type: Type.STRING },
                    quizTopic: { type: Type.STRING },
                    capstoneTitle: { type: Type.STRING }
                  }
                },
                resources: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                }
              },
              required: ['title', 'description', 'estimatedWeeks', 'resources']
            }
          }
        },
        required: ['phaseNumber', 'phaseTitle', 'milestones']
      }
    }
  },
  required: ['roadmapTitle', 'duration', 'phases']
};

module.exports = Roadmap;
module.exports.roadmapResponseSchema = roadmapResponseSchema;