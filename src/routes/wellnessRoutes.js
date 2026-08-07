const express = require('express');
const router = express.Router();
const {
  logWater,
  logScreenTime,
  getCheckIn,
  getHistory,
  updateGoals,
  deleteEntry,
  updateReminderSettings,
  getNotifications,
  markNotificationRead
} = require('../controllers/wellnessController');
const { protect } = require('../middleware/auth');

// check in
router.post('/water', protect, logWater);
router.post('/screen-time', protect, logScreenTime);
router.get('/today', protect, getCheckIn);          // ?date=YYYY-MM-DD optional
router.get('/history', protect, getHistory);         // ?days=7 (default), max 90
router.delete('/:type/:entryId', protect, deleteEntry); // :type = water | screen-time, ?date=YYYY-MM-DD

// goals
router.put('/goals', protect, updateGoals);

// reminder
router.put('/reminder', protect, updateReminderSettings);

// notification
router.get('/notifications', protect, getNotifications);
router.put('/notifications/:id/read', protect, markNotificationRead);

module.exports = router;