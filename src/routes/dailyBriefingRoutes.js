const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const dailyBriefingController = require('../controllers/dailyBriefingController');

// All endpoints require authenticated user via explicit protect middleware
router.get('/today', protect, dailyBriefingController.getTodayBriefing);
router.post('/regenerate', protect, dailyBriefingController.regenerateBriefing);

module.exports = router;
