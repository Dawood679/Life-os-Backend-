const express = require('express');
const router = express.Router();
const {
  getProposal,
  applyRecovery,
  undoRecovery
} = require('../controllers/reschedulerController');
const { protect } = require('../middleware/auth');

router.get('/proposal', protect, getProposal);
router.post('/apply', protect, applyRecovery);
router.post('/undo', protect, undoRecovery);

module.exports = router;
