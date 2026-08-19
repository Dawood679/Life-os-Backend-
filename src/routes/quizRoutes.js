const express = require('express');
const router = express.Router();
const {
  generateQuiz,
  getQuizzes,
  getQuiz,
  deleteQuiz,
  submitQuiz
} = require('../controllers/quizController');
const { protect } = require('../middleware/auth');

router.post('/generate', protect, generateQuiz);
router.post("/:id/submit",protect, submitQuiz);
router.get('/', protect, getQuizzes);
router.get('/:id', protect, getQuiz);
router.delete('/:id', protect, deleteQuiz);

module.exports = router;