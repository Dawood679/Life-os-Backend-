const mongoose = require('mongoose');

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
      unique: true
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

module.exports = mongoose.model('Roadmap', roadmapSchema);