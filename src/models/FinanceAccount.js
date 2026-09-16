const mongoose = require('mongoose');

const financeAccountSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Account name is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: ['bank', 'cash', 'savings', 'credit', 'investment', 'mfs'],
      default: 'bank',
    },
    balance: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      default: 'USD',
      trim: true,
    },
    color: {
      type: String,
      default: '#0ea5e9',
    },
    icon: {
      type: String,
      default: 'Wallet',
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

financeAccountSchema.index({ user: 1, name: 1 });

module.exports = mongoose.model('FinanceAccount', financeAccountSchema);
