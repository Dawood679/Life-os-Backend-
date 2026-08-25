const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { analyzeGoal, selectFocus } = require('../controllers/onboardingController');

router.use(protect);

router.post('/analyze-goal', analyzeGoal);
router.post('/select-focus', selectFocus);

module.exports = router;
