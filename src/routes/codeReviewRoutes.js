const express = require('express');
const router = express.Router();
const {
  reviewCode,
  getReviews,
  getReview,
  deleteReview
} = require('../controllers/codeReviewController');
const { protect } = require('../middleware/auth');

router.post('/review', protect, reviewCode);
router.get('/', protect, getReviews);
router.get('/:id', protect, getReview);
router.delete('/:id', protect, deleteReview);

module.exports = router;