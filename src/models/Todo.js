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