const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getTodayScore,
  getScoreHistory,
  updateFocusMode,
  getVerifiedSkills
} = require('../controllers/lifeScoreController');

router.use(protect);

router.get('/today', getTodayScore);
router.get('/history', getScoreHistory);
router.patch('/focus-mode', updateFocusMode);
router.get('/verified-skills', getVerifiedSkills);

module.exports = router;
