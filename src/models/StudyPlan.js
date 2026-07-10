const mongoose = require('mongoose');
const { Type } = require('@google/genai');

const dailyTaskSchema = new mongoose.Schema({
  tasks: [{ type: String }]
});

const weeklyTargetSchema = new mongoose.Schema({
  week: { type: Number },
  target: { type: String },
  topics: [{ type: String }],
  successCriteria: { type: String }
});

const studyPlanSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    currentLevel: { type: String, required: true },     
    subject: { type: String, required: true },         

    // AI Generated Output
    planTitle: { type: String },
    summary: { type: String },
    dailyPlan: [dailyTaskSchema],
    weeklyTargets: [weeklyTargetSchema],
    tips: [{ type: String }],
    rawResponse: { type: String },
    generatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

// Gemini structured output schemas
const studyPlanResponseSchema = {
  type: Type.OBJECT,
  properties: {
    planTitle: { type: Type.STRING },
    summary: { type: Type.STRING },
    dailyPlan: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          tasks: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ['tasks'] 
      }
    },
    weeklyTargets: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          week: { type: Type.INTEGER },
          target: { type: Type.STRING },
          topics: { type: Type.ARRAY, items: { type: Type.STRING } },
          successCriteria: { type: Type.STRING }
        },
        required: ['week', 'target', 'topics', 'successCriteria']
      }
    },
    tips: { type: Type.ARRAY, items: { type: Type.STRING } }
  },
  required: ['planTitle', 'summary', 'dailyPlan', 'weeklyTargets', 'tips'] 
};

module.exports = mongoose.model('StudyPlan', studyPlanSchema);
module.exports.studyPlanResponseSchema = studyPlanResponseSchema;