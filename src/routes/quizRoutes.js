const express = require('express');
const router = express.Router();
const {
  generateQuiz,
  getQuizzes,
  getQuiz,
  deleteQuiz
} = require('../controllers/quizController');
const { protect } = require('../middleware/auth');

router.post('/generate', protect, generateQuiz);
router.get('/', protect, getQuizzes);
router.get('/:id', protect, getQuiz);
router.delete('/:id', protect, deleteQuiz);

module.exports = router;