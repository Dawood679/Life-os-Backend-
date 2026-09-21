const mongoose = require('mongoose');

const systemSettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      default: 'feature_flags'
    },
    flags: {
      mock_interview: {
        isEnabled: { type: Boolean, default: true },
        maintenanceMessage: { type: String, default: 'AI Mock Interview is currently undergoing scheduled upgrades.' }
      },
      roadmap_generator: {
        isEnabled: { type: Boolean, default: true },
        maintenanceMessage: { type: String, default: '90-Day Roadmap Generator is temporarily offline.' }
      },
      study_planner: {
        isEnabled: { type: Boolean, default: true },
        maintenanceMessage: { type: String, default: 'Study Planner service is updating.' }
      },
      quiz_center: {
        isEnabled: { type: Boolean, default: true },
        maintenanceMessage: { type: String, default: 'AI Quiz & Certification Center is in maintenance.' }
      },
      daily_briefing: {
        isEnabled: { type: Boolean, default: true },
        maintenanceMessage: { type: String, default: 'Daily Briefing generation is paused.' }
      },
      copilot_assistant: {
        isEnabled: { type: Boolean, default: true },
        maintenanceMessage: { type: String, default: 'Chief of Staff Copilot is undergoing tuning.' }
      },
      prescription_scanner: {
        isEnabled: { type: Boolean, default: true },
        maintenanceMessage: { type: String, default: 'Prescription OCR Scanner is temporarily disabled.' }
      },
      resume_analyzer: {
        isEnabled: { type: Boolean, default: true },
        maintenanceMessage: { type: String, default: 'Resume & Pitch Analyzer is updating.' }
      }
    },
    globalMaintenanceMode: {
      isEnabled: { type: Boolean, default: false },
      message: { type: String, default: 'LifeOS is currently undergoing scheduled infrastructure maintenance.' }
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('SystemSetting', systemSettingSchema);
