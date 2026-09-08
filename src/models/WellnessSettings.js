const mongoose = require('mongoose');

const wellnessSettingsSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    waterGoalMl: { type: Number, default: 2000 },
    screenTimeGoalMinutes: { type: Number, default: 120 },

    // water reminder
    reminder: {
      enabled: { type: Boolean, default: false },
      mode: { type: String, enum: ['manual', 'auto'], default: 'auto' },
      intervalMinutes: { type: Number, default: 120 }, // used directly if mode = "manual"

      // Active window — reminders only fire inside this range (also used to
      // auto-calculate interval when mode = "auto")
      activeStart: { type: String, default: '08:00' }, // "HH:mm", 24hr
      activeEnd: { type: String, default: '22:00' },

      emailEnabled: { type: Boolean, default: true },
      inAppEnabled: { type: Boolean, default: true },

      // Internal bookkeeping for the scheduler
      nextReminderAt: { type: Date, default: null },
      lastReminderSentAt: { type: Date, default: null }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('WellnessSettings', wellnessSettingsSchema);