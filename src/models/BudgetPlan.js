const mongoose = require('mongoose');

const budgetCategorySchema = new mongoose.Schema({
  category: {
    type: String,
    required: true,
    trim: true,
  },
  budgeted: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
  },
  color: {
    type: String,
    default: '#6366f1',
  },
});

const budgetPlanSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    month: {
      type: String, // Format: 'YYYY-MM', e.g., '2026-09'
      required: true,
      trim: true,
      index: true,
    },
    overallBudget: {
      type: Number,
      default: 0,
      min: 0,
    },
    categories: [budgetCategorySchema],
    savingsGoal: {
      type: Number,
      default: 0,
      min: 0,
    },
    alertThresholdPercent: {
      type: Number,
      default: 80,
      min: 1,
      max: 100,
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

budgetPlanSchema.index({ user: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('BudgetPlan', budgetPlanSchema);
