const mongoose = require('mongoose');
const { Type } = require('@google/genai');

const milestoneSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  estimatedWeeks: { type: Number },
  resources: [{ type: String }]
});

const phaseSchema = new mongoose.Schema({
  phaseNumber: { type: Number, required: true },
  phaseTitle: { type: String, required: true },
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
    duration: { type: String },
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

// Gemini schemas for roadmap
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
          milestones: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                estimatedWeeks: { type: Type.INTEGER },
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