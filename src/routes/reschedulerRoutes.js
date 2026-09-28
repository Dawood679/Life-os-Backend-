const express = require('express');
const router = express.Router();
const {
  getProposal,
  applyRecovery,
  undoRecovery
} = require('../controllers/reschedulerController');
const { protect } = require('../middleware/auth');
const { requireFeatureQuota } = require('../middleware/planLimiter');

router.get('/proposal', protect, getProposal);
router.post('/apply', protect, requireFeatureQuota('smart_rescheduler'), applyRecovery);
router.post('/undo', protect, undoRecovery);

module.exports = router;
