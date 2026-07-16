const express = require('express');
const router = express.Router();
const {
  analyzeJobMatch,
  getJobMatches,
  getJobMatch,
  deleteJobMatch
} = require('../controllers/jobMatchController');
const { protect } = require('../middleware/auth');

router.post('/analyze', protect, analyzeJobMatch);
router.get('/', protect, getJobMatches);
router.get('/:id', protect, getJobMatch);
router.delete('/:id', protect, deleteJobMatch);

module.exports = router;