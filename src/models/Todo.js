const mongoose = require('mongoose');

const todoSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium'
    },
    dueDate: {
      type: Date,
      default: Date.now,
      required: [true, 'Date and time is required']
    },
    repeat: {
      type: String,
      enum: ['none', 'daily', 'weekdays', 'weekly', 'monthly', 'custom'],
      default: 'none'
    },
    customDays: {
      type: [Number], // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      default: []
    },
    notificationChannel: {
      type: String,
      enum: ['in_app', 'email', 'both', 'none'],
      default: 'in_app'
    },
    reminderMinutesBefore: {
      type: Number,
      default: 10
    },
    reminderTime: {
      type: Date
    },
    isCompleted: {
      type: Boolean,
      default: false
    },
    completedAt: {
      type: Date
    },
    reminderSent: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Todo', todoSchema);