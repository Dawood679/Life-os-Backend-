const mongoose = require('mongoose');

const broadcastAnnouncementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: ['announcement', 'system_update', 'alert'],
      default: 'announcement'
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal'
    },
    link: {
      type: String,
      default: ''
    },
    targetDomain: {
      type: String,
      default: 'all'
    },
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    recipientCount: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('BroadcastAnnouncement', broadcastAnnouncementSchema);
