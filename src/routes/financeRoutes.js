const express = require('express');
const router = express.Router();
const {
  getFinanceSummary,
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getAccounts,
  createAccount,
  getBudget,
  saveBudget,
  importTransactions,
} = require('../controllers/financeController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Summary & Analytics HUD
router.get('/summary', getFinanceSummary);

// Transactions CRUD & Import
router.get('/transactions', getTransactions);
router.post('/transactions', createTransaction);
router.put('/transactions/:id', updateTransaction);
router.delete('/transactions/:id', deleteTransaction);
router.post('/import', importTransactions);

// Accounts / Wallets
router.get('/accounts', getAccounts);
router.post('/accounts', createAccount);

// Monthly Budget Planning
router.get('/budget', getBudget);
router.post('/budget', saveBudget);

module.exports = router;
