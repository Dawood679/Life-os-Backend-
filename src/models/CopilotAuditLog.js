const mongoose = require('mongoose');

const copilotAuditLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    command: {
      type: String,
      required: true
    },
    intent: {
      type: String,
      default: 'general_qa',
      index: true
    },
    detectedTool: {
      type: String,
      default: null
    },
    rawArgs: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    sanitizedArgs: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    status: {
      type: String,
      enum: ['EXECUTED', 'PROPOSED', 'CONFIRMED', 'CANCELLED', 'SANITY_REJECTED', 'FAILED'],
      default: 'EXECUTED',
      index: true
    },
    isDestructive: {
      type: Boolean,
      default: false
    },
    confirmationToken: {
      type: String,
      default: null,
      index: true
    },
    aiProvider: {
      type: String,
      enum: ['gemini', 'groq', 'deterministic', 'system', 'fallback'],
      default: 'gemini'
    },
    actionResponse: {
      type: String,
      default: ''
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('CopilotAuditLog', copilotAuditLogSchema);
