const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getWeeklyReport, getWeeklyStatsOnly } = require('../controllers/weeklyReportController');

router.use(protect);

router.get('/', getWeeklyReport);
router.get('/stats', getWeeklyStatsOnly);
router.post('/generate', getWeeklyReport);

module.exports = router;
