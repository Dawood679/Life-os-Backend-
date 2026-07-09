const mongoose = require('mongoose');

const dailyTaskSchema = new mongoose.Schema({
  day: { type: String },
  date: { type: String },         
  tasks: [{ type: String }],       
  estimatedHours: { type: Number } 
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
    // Input fields
    freeTimePerDay: { type: Number, required: true },
    deadline: { type: String, required: true },         
    currentLevel: { type: String, required: true },     
    subject: { type: String, required: true },         

    // AI Generated Output
    planTitle: { type: String },
    summary: { type: String },
    totalWeeks: { type: Number },
    dailyPlan: [dailyTaskSchema],
    weeklyTargets: [weeklyTargetSchema],
    tips: [{ type: String }],
    rawResponse: { type: String },
    generatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

module.exports = mongoose.model('StudyPlan', studyPlanSchema);