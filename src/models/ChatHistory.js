const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  userMessage: { type: String },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  aiResponse: { type: String },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const chatHistorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    title: {
      type: String,
      default: 'New Chat'
    },
    messages: [messageSchema]
  },
  { timestamps: true }
);

module.exports = mongoose.model('ChatHistory', chatHistorySchema);