const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    prescription: { type: mongoose.Schema.Types.ObjectId, ref: 'Prescription', default: null },
    doctorName: { type: String, required: true, trim: true },
    appointmentDate: { type: String, required: true },
    reason: { type: String, default: 'Follow-up checkup' },
    questionsChecklist: { type: [String], default: [] },
    status: { type: String, enum: ['upcoming', 'completed', 'cancelled'], default: 'upcoming' },
    
    // NEW: Notification Settings
    reminder: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
      isNotified: { type: Boolean, default: false } // Prevents duplicate triggers
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Appointment', appointmentSchema);