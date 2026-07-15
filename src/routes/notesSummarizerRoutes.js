const express = require('express');
const router = express.Router();
const {
  generateSummary,
  getSummaries,
  getSummary,
  deleteSummary
} = require('../controllers/notesSummarizerController');
const { protect } = require('../middleware/auth');

router.post('/summarize', protect, generateSummary);
router.get('/', protect, getSummaries);
router.get('/:id', protect, getSummary);
router.delete('/:id', protect, deleteSummary);

module.exports = router;