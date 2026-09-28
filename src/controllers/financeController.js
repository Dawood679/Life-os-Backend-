const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const FinanceAccount = require('../models/FinanceAccount');
const BudgetPlan = require('../models/BudgetPlan');

// Helper to get start and end dates of a month (YYYY-MM)
const getMonthDateRange = (monthStr) => {
  let date;
  if (monthStr && /^\d{4}-\d{2}$/.test(monthStr)) {
    const [year, month] = monthStr.split('-').map(Number);
    date = new Date(Date.UTC(year, month - 1, 1));
  } else {
    const now = new Date();
    date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  const formattedMonth = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`;
  return { start, end, monthStr: formattedMonth };
};

// @desc    Get complete Finance Summary & Analytics HUD
// @route   GET /api/finance/summary
// @access  Private
exports.getFinanceSummary = async (req, res) => {
  try {
    const userId = req.user._id;
    const requestedMonth = req.query.month; // e.g. '2026-09'
    const { start: monthStart, end: monthEnd, monthStr } = getMonthDateRange(requestedMonth);

    // 1. Get Accounts & Calculate Net Worth
    let accounts = await FinanceAccount.find({ user: userId });
    
    // Seed default accounts if user has none
    if (accounts.length === 0) {
      accounts = await FinanceAccount.create([
        { user: userId, name: 'Main Checking', type: 'bank', balance: 0, color: '#0ea5e9', isDefault: true },
        { user: userId, name: 'Cash Wallet', type: 'cash', balance: 0, color: '#10b981' },
        { user: userId, name: 'Emergency Savings', type: 'savings', balance: 0, color: '#6366f1' },
      ]);
    }

    const netWorth = accounts.reduce((sum, acc) => {
      if (acc.type === 'credit') {
        return sum - (acc.balance || 0); // Credit cards are liabilities
      }
      return sum + (acc.balance || 0);
    }, 0);

    const liquidSavings = accounts
      .filter((acc) => acc.type === 'savings' || acc.type === 'bank' || acc.type === 'cash')
      .reduce((sum, acc) => sum + Math.max(0, acc.balance || 0), 0);

    // 2. Current Month Income & Expenses
    const currentMonthStats = await Transaction.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(userId),
          date: { $gte: monthStart, $lte: monthEnd },
        },
      },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    let monthlyIncome = 0;
    let monthlyExpense = 0;

    currentMonthStats.forEach((stat) => {
      if (stat._id === 'income') monthlyIncome = stat.total;
      if (stat._id === 'expense') monthlyExpense = stat.total;
    });

    const netSavings = monthlyIncome - monthlyExpense;
    const savingsRate = monthlyIncome > 0 ? Math.max(0, Math.round((netSavings / monthlyIncome) * 100)) : 0;

    // 3. Category Breakdown for current month
    const categoryBreakdown = await Transaction.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(userId),
          type: 'expense',
          date: { $gte: monthStart, $lte: monthEnd },
        },
      },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]);

    // 4. Past 6 Months Cash Flow Trend
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const historicalTrends = await Transaction.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(userId),
          date: { $gte: sixMonthsAgo },
          type: { $in: ['income', 'expense'] },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
            type: '$type',
          },
          total: { $sum: '$amount' },
        },
      },
    ]);

    // Format 6 months chart data
    const monthsMap = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('en-US', { month: 'short' });
      monthsMap[key] = { month: label, key, income: 0, expense: 0, net: 0 };
    }

    historicalTrends.forEach((item) => {
      const key = `${item._id.year}-${String(item._id.month).padStart(2, '0')}`;
      if (monthsMap[key]) {
        if (item._id.type === 'income') monthsMap[key].income = item.total;
        if (item._id.type === 'expense') monthsMap[key].expense = item.total;
        monthsMap[key].net = monthsMap[key].income - monthsMap[key].expense;
      }
    });

    const cashFlowTrend = Object.values(monthsMap);

    // 5. Calculate Financial Runway (Liquid Savings / Avg Monthly Expense)
    const pastExpenses = cashFlowTrend.map((m) => m.expense).filter((exp) => exp > 0);
    const avgMonthlyExpense = pastExpenses.length > 0
      ? pastExpenses.reduce((a, b) => a + b, 0) / pastExpenses.length
      : monthlyExpense || 1000;

    const runwayMonths = avgMonthlyExpense > 0
      ? Number((liquidSavings / avgMonthlyExpense).toFixed(1))
      : 12.0;

    // 6. Active Budget & Spending Limits
    let budgetPlan = await BudgetPlan.findOne({ user: userId, month: monthStr });
    
    let budgetProgress = null;
    if (budgetPlan) {
      const categorySpentMap = {};
      categoryBreakdown.forEach((c) => {
        categorySpentMap[c._id] = c.total;
      });

      const categoriesWithProgress = budgetPlan.categories.map((bCat) => {
        const spent = categorySpentMap[bCat.category] || 0;
        const percentUsed = bCat.budgeted > 0 ? Math.round((spent / bCat.budgeted) * 100) : 0;
        return {
          category: bCat.category,
          budgeted: bCat.budgeted,
          spent,
          color: bCat.color,
          percentUsed,
          isOverbudget: spent > bCat.budgeted,
        };
      });

      const totalBudgeted = budgetPlan.categories.reduce((s, c) => s + (c.budgeted || 0), budgetPlan.overallBudget || 0);
      budgetProgress = {
        month: budgetPlan.month,
        overallBudget: totalBudgeted,
        totalSpent: monthlyExpense,
        percentUsed: totalBudgeted > 0 ? Math.round((monthlyExpense / totalBudgeted) * 100) : 0,
        categories: categoriesWithProgress,
        savingsGoal: budgetPlan.savingsGoal,
      };
    }

    // 7. Recent Transactions
    const recentTransactions = await Transaction.find({ user: userId })
      .sort({ date: -1, createdAt: -1 })
      .limit(6);

    return res.status(200).json({
      success: true,
      data: {
        month: monthStr,
        metrics: {
          netWorth,
          liquidSavings,
          monthlyIncome,
          monthlyExpense,
          netSavings,
          savingsRate,
          runwayMonths,
          avgMonthlyExpense: Math.round(avgMonthlyExpense),
        },
        accounts,
        categoryBreakdown,
        cashFlowTrend,
        budgetProgress,
        recentTransactions,
      },
    });
  } catch (error) {
    console.error('Error fetching finance summary:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve financial summary',
      error: error.message,
    });
  }
};

// @desc    Get all transactions with filtering & pagination
// @route   GET /api/finance/transactions
// @access  Private
exports.getTransactions = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      type,
      category,
      account,
      search,
      month,
      startDate,
      endDate,
      page = 1,
      limit = 20,
      sort = '-date',
    } = req.query;

    const query = { user: userId };

    if (type && type !== 'all') {
      query.type = type;
    }

    if (category && category !== 'all') {
      query.category = category;
    }

    if (account && account !== 'all') {
      query.account = account;
    }

    if (search) {
      query.$or = [
        { description: { $regex: search, $options: 'i' } },
        { merchant: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
      ];
    }

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const { start, end } = getMonthDateRange(month);
      query.date = { $gte: start, $lte: end };
    } else if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [transactions, total] = await Promise.all([
      Transaction.find(query).sort(sort).skip(skip).limit(Number(limit)),
      Transaction.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        transactions,
        pagination: {
          total,
          page: Number(page),
          pages: Math.ceil(total / Number(limit)) || 1,
          limit: Number(limit),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve transactions',
      error: error.message,
    });
  }
};

// @desc    Create a new transaction and update account balance
// @route   POST /api/finance/transactions
// @access  Private
exports.createTransaction = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      type,
      amount,
      category,
      account,
      toAccount,
      date,
      description,
      merchant,
      receiptUrl,
      isRecurring,
      recurringFrequency,
      tags,
      crossModuleMeta,
    } = req.body;

    if (!type || amount === undefined || !category || !account) {
      return res.status(400).json({
        success: false,
        message: 'Type, amount, category, and account are required fields',
      });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount < 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid transaction amount',
      });
    }

    const transaction = await Transaction.create({
      user: userId,
      type,
      amount: numAmount,
      category,
      account,
      toAccount: type === 'transfer' ? toAccount : undefined,
      date: date ? new Date(date) : new Date(),
      description: description || '',
      merchant: merchant || '',
      receiptUrl,
      isRecurring: Boolean(isRecurring),
      recurringFrequency: recurringFrequency || 'none',
      tags: Array.isArray(tags) ? tags : [],
      crossModuleMeta: crossModuleMeta || { source: 'manual' },
    });

    // Auto-update Account Balances
    const targetAccount = await FinanceAccount.findOne({ user: userId, name: account });
    if (targetAccount) {
      if (type === 'income') {
        targetAccount.balance += numAmount;
      } else if (type === 'expense') {
        targetAccount.balance -= numAmount;
      } else if (type === 'transfer') {
        targetAccount.balance -= numAmount;
        if (toAccount) {
          const destinationAccount = await FinanceAccount.findOne({ user: userId, name: toAccount });
          if (destinationAccount) {
            destinationAccount.balance += numAmount;
            await destinationAccount.save();
          }
        }
      }
      await targetAccount.save();
    }

    return res.status(201).json({
      success: true,
      message: 'Transaction recorded successfully',
      data: transaction,
    });
  } catch (error) {
    console.error('Error creating transaction:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create transaction',
      error: error.message,
    });
  }
};

// @desc    Update an existing transaction and adjust balances
// @route   PUT /api/finance/transactions/:id
// @access  Private
exports.updateTransaction = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const existing = await Transaction.findOne({ _id: id, user: userId });
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found',
      });
    }

    // Revert old balance adjustment
    const oldAccount = await FinanceAccount.findOne({ user: userId, name: existing.account });
    if (oldAccount) {
      if (existing.type === 'income') {
        oldAccount.balance -= existing.amount;
      } else if (existing.type === 'expense') {
        oldAccount.balance += existing.amount;
      } else if (existing.type === 'transfer') {
        oldAccount.balance += existing.amount;
        if (existing.toAccount) {
          const oldToAccount = await FinanceAccount.findOne({ user: userId, name: existing.toAccount });
          if (oldToAccount) {
            oldToAccount.balance -= existing.amount;
            await oldToAccount.save();
          }
        }
      }
      await oldAccount.save();
    }

    // Apply updates
    const updated = await Transaction.findByIdAndUpdate(
      id,
      { ...req.body, user: userId },
      { new: true, runValidators: true }
    );

    // Apply new balance adjustment
    const newAccount = await FinanceAccount.findOne({ user: userId, name: updated.account });
    if (newAccount) {
      if (updated.type === 'income') {
        newAccount.balance += updated.amount;
      } else if (updated.type === 'expense') {
        newAccount.balance -= updated.amount;
      } else if (updated.type === 'transfer') {
        newAccount.balance -= updated.amount;
        if (updated.toAccount) {
          const newToAccount = await FinanceAccount.findOne({ user: userId, name: updated.toAccount });
          if (newToAccount) {
            newToAccount.balance += updated.amount;
            await newToAccount.save();
          }
        }
      }
      await newAccount.save();
    }

    return res.status(200).json({
      success: true,
      message: 'Transaction updated successfully',
      data: updated,
    });
  } catch (error) {
    console.error('Error updating transaction:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update transaction',
      error: error.message,
    });
  }
};

// @desc    Delete a transaction and restore account balance
// @route   DELETE /api/finance/transactions/:id
// @access  Private
exports.deleteTransaction = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const transaction = await Transaction.findOneAndDelete({ _id: id, user: userId });
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found',
      });
    }

    // Restore Account Balance
    const targetAccount = await FinanceAccount.findOne({ user: userId, name: transaction.account });
    if (targetAccount) {
      if (transaction.type === 'income') {
        targetAccount.balance -= transaction.amount;
      } else if (transaction.type === 'expense') {
        targetAccount.balance += transaction.amount;
      } else if (transaction.type === 'transfer') {
        targetAccount.balance += transaction.amount;
        if (transaction.toAccount) {
          const destAccount = await FinanceAccount.findOne({ user: userId, name: transaction.toAccount });
          if (destAccount) {
            destAccount.balance -= transaction.amount;
            await destAccount.save();
          }
        }
      }
      await targetAccount.save();
    }

    return res.status(200).json({
      success: true,
      message: 'Transaction deleted and balance restored',
    });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete transaction',
      error: error.message,
    });
  }
};

// @desc    Get all user financial accounts/wallets
// @route   GET /api/finance/accounts
// @access  Private
exports.getAccounts = async (req, res) => {
  try {
    const userId = req.user._id;
    const accounts = await FinanceAccount.find({ user: userId }).sort({ createdAt: 1 });
    return res.status(200).json({
      success: true,
      data: accounts,
    });
  } catch (error) {
    console.error('Error fetching accounts:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch accounts',
      error: error.message,
    });
  }
};

// @desc    Create a new account/wallet
// @route   POST /api/finance/accounts
// @access  Private
exports.createAccount = async (req, res) => {
  try {
    const userId = req.user._id;
    const { name, type, balance, currency, color, icon, notes } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Account name is required',
      });
    }

    const existing = await FinanceAccount.findOne({ user: userId, name: name.trim() });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'An account with this name already exists',
      });
    }

    const account = await FinanceAccount.create({
      user: userId,
      name: name.trim(),
      type: type || 'bank',
      balance: Number(balance) || 0,
      currency: currency || 'USD',
      color: color || '#0ea5e9',
      icon: icon || 'Wallet',
      notes: notes || '',
    });

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: account,
    });
  } catch (error) {
    console.error('Error creating account:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create account',
      error: error.message,
    });
  }
};

// @desc    Get or initialize Budget Plan for a month
// @route   GET /api/finance/budget
// @access  Private
exports.getBudget = async (req, res) => {
  try {
    const userId = req.user._id;
    const { month } = req.query;
    const { start, end, monthStr } = getMonthDateRange(month);

    let budget = await BudgetPlan.findOne({ user: userId, month: monthStr });

    if (!budget) {
      // Default initial categories
      budget = await BudgetPlan.create({
        user: userId,
        month: monthStr,
        overallBudget: 2500,
        savingsGoal: 500,
        categories: [
          { category: 'Housing & Rent', budgeted: 1000, color: '#6366f1' },
          { category: 'Food & Dining', budgeted: 500, color: '#f59e0b' },
          { category: 'Tech & Tools', budgeted: 200, color: '#0ea5e9' },
          { category: 'Learning & Courses', budgeted: 150, color: '#a855f7' },
          { category: 'Healthcare', budgeted: 150, color: '#10b981' },
          { category: 'Transportation', budgeted: 150, color: '#ec4899' },
          { category: 'Entertainment', budgeted: 100, color: '#8b5cf6' },
          { category: 'Other', budgeted: 250, color: '#64748b' },
        ],
      });
    }

    // Aggregate actual spent for this month
    const categoryExpenses = await Transaction.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(userId),
          type: 'expense',
          date: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: '$category',
          spent: { $sum: '$amount' },
        },
      },
    ]);

    const spentMap = {};
    let totalSpent = 0;
    categoryExpenses.forEach((c) => {
      spentMap[c._id] = c.spent;
      totalSpent += c.spent;
    });

    const categoriesWithSpent = budget.categories.map((c) => ({
      _id: c._id,
      category: c.category,
      budgeted: c.budgeted,
      color: c.color,
      spent: spentMap[c.category] || 0,
      percentUsed: c.budgeted > 0 ? Math.round(((spentMap[c.category] || 0) / c.budgeted) * 100) : 0,
    }));

    return res.status(200).json({
      success: true,
      data: {
        _id: budget._id,
        month: budget.month,
        overallBudget: budget.overallBudget,
        savingsGoal: budget.savingsGoal,
        totalSpent,
        percentUsed: budget.overallBudget > 0 ? Math.round((totalSpent / budget.overallBudget) * 100) : 0,
        categories: categoriesWithSpent,
        alertThresholdPercent: budget.alertThresholdPercent,
      },
    });
  } catch (error) {
    console.error('Error fetching budget:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch budget',
      error: error.message,
    });
  }
};

// @desc    Save/Update Budget Plan
// @route   POST /api/finance/budget
// @access  Private
exports.saveBudget = async (req, res) => {
  try {
    const userId = req.user._id;
    const { month, overallBudget, categories, savingsGoal, alertThresholdPercent } = req.body;

    const { monthStr } = getMonthDateRange(month);

    const budget = await BudgetPlan.findOneAndUpdate(
      { user: userId, month: monthStr },
      {
        user: userId,
        month: monthStr,
        overallBudget: Number(overallBudget) || 0,
        categories: Array.isArray(categories) ? categories : [],
        savingsGoal: Number(savingsGoal) || 0,
        alertThresholdPercent: Number(alertThresholdPercent) || 80,
      },
      { new: true, upsert: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Budget plan updated successfully',
      data: budget,
    });
  } catch (error) {
    console.error('Error saving budget:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save budget plan',
      error: error.message,
    });
  }
};

// @desc    Bulk Import transactions from CSV/Excel
// @route   POST /api/finance/import
// @access  Private
exports.importTransactions = async (req, res) => {
  try {
    const userId = req.user._id;
    const { transactions } = req.body;

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No transactions provided for import',
      });
    }

    const docs = transactions.map((t) => ({
      user: userId,
      type: t.type || 'expense',
      amount: Number(t.amount) || 0,
      category: t.category || 'Other',
      account: t.account || 'Cash',
      date: t.date ? new Date(t.date) : new Date(),
      description: t.description || '',
      merchant: t.merchant || '',
    }));

    const inserted = await Transaction.insertMany(docs);

    return res.status(201).json({
      success: true,
      message: `Successfully imported ${inserted.length} transactions`,
      data: inserted,
    });
  } catch (error) {
    console.error('Error importing transactions:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to import transactions',
      error: error.message,
    });
  }
};
