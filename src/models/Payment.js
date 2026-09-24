const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    userEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    userName: {
      type: String,
      required: true,
      trim: true
    },
    amount: {
      type: Number,
      required: true // in cents, e.g. 1900 ($19.00), 18000 ($180.00)
    },
    currency: {
      type: String,
      default: 'usd',
      uppercase: true
    },
    plan: {
      type: String,
      enum: ['pro_monthly', 'pro_yearly', 'yearly_pass', 'pro', 'starter'],
      required: true
    },
    billingCycle: {
      type: String,
      enum: ['monthly', 'yearly', 'none'],
      default: 'monthly'
    },
    status: {
      type: String,
      enum: ['succeeded', 'pending', 'failed', 'refunded'],
      default: 'succeeded'
    },
    paymentGateway: {
      type: String,
      enum: ['stripe', 'simulation', 'manual'],
      default: 'stripe'
    },
    stripeSessionId: {
      type: String,
      default: ''
    },
    stripeCustomerId: {
      type: String,
      default: ''
    },
    stripeSubscriptionId: {
      type: String,
      default: ''
    },
    receiptUrl: {
      type: String,
      default: ''
    },
    metadata: {
      type: Map,
      of: String
    }
  },
  {
    timestamps: true
  }
);

paymentSchema.index({ user: 1, createdAt: -1 });
paymentSchema.index({ userEmail: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ plan: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
