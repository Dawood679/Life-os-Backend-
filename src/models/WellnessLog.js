const mongoose = require('mongoose');

const waterEntrySchema = new mongoose.Schema(
  {
    amountMl: { type: Number, required: true, min: 1 },
    loggedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const wellnessLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    date: {
      type: String, // "YYYY-MM-DD" — user's local date, sent from client
      required: true
    },
    water: {
      targetMl: { type: Number, default: 2000 },
      consumedMl: { type: Number, default: 0 },
      entries: [waterEntrySchema]
    },
    screenTime: {
      limitMinutes: { type: Number, default: 120 },
      usedMinutes: { type: Number, default: 0 }
    },
    sleep: {
      hours: { type: Number, min: 0, max: 24 },
      quality: {
        type: String,
        enum: ['poor', 'average', 'good', 'excellent']
      }
    },
    mood: {
      value: { type: Number, min: 1, max: 5 },
      note: { type: String, maxlength: 300 }
    },
    activity: {
      type: {
        type: String,
        enum: ['walk', 'gym', 'yoga', 'run', 'cycling', 'other', 'none'],
        default: 'none'
      },
      minutes: { type: Number, default: 0, min: 0 }
    },
    energyScore: {
      type: Number,
      default: null
    }
  },
  { timestamps: true }
);

const weeklyReportResponseSchema = {
  type: 'object',
  properties: {
    report: {
      type: 'string',
      description: 'Engaging, direct 3-4 sentence narrative correlating wellness metrics with task completion.'
    },
    keyInsight: {
      type: 'string',
      description: 'The single biggest factor affecting productivity this week.'
    },
    actionableTip: {
      type: 'string',
      description: 'One realistic, high-impact recommendation for the upcoming week.'
    },
    burnoutRisk: {
      type: 'string',
      enum: ['low', 'moderate', 'high'],
      description: 'Calculated burnout risk level based on the real data.'
    }
  },
  required: ['report', 'keyInsight', 'actionableTip', 'burnoutRisk']
};

// one log per user per day — prevents duplicate documents
wellnessLogSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('WellnessLog', wellnessLogSchema);
module.exports.weeklyReportResponseSchema = weeklyReportResponseSchema;