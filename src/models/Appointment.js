const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    prescription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Prescription',
      default: null
    },
    doctorName: {
      type: String,
      required: true,
      trim: true
    },
    appointmentDate: {
      type: String, // YYYY-MM-DD HH:mm or YYYY-MM-DD
      required: true
    },
    reason: {
      type: String,
      default: 'Follow-up checkup'
    },
    questionsChecklist: {
      type: [String],
      default: []
    },
    status: {
      type: String,
      enum: ['upcoming', 'completed', 'cancelled'],
      default: 'upcoming'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Appointment', appointmentSchema);