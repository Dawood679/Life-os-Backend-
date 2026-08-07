const mongoose = require('mongoose');

const wellnessCheckInSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    date: { type: String, required: true }, // "YYYY-MM-DD" — the day this check-in belongs to

    water: {
      goalMl: { type: Number, default: 2000 },
      totalMl: { type: Number, default: 0 },
      entries: [
        {
          amountMl: { type: Number, required: true },
          loggedAt: { type: Date, default: Date.now }
        }
      ]
    },

    screenTime: {
      goalMinutes: { type: Number, default: 120 },
      totalMinutes: { type: Number, default: 0 },
      entries: [
        {
          minutes: { type: Number, required: true },
          category: { type: String, default: 'general' },
          loggedAt: { type: Date, default: Date.now }
        }
      ]
    }
  },
  { timestamps: true }
);

wellnessCheckInSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('WellnessCheckIn', wellnessCheckInSchema);