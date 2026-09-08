const express = require('express');
const router = express.Router();
const {
  generateStudyPlan,
  verifyTaskMicroQuiz,
  regenerateTaskMicroQuiz,
  getStudyPlans,
  getStudyPlan,
  deleteStudyPlan
} = require('../controllers/studyPlanController');
const { protect } = require('../middleware/auth');

router.post('/generate', protect, generateStudyPlan);
router.post('/:id/task/:taskNumber/verify', protect, verifyTaskMicroQuiz);
router.post('/:id/task/:taskNumber/regenerate-quiz', protect, regenerateTaskMicroQuiz);
router.get('/', protect, getStudyPlans);
router.get('/:id', protect, getStudyPlan);
router.delete('/:id', protect, deleteStudyPlan);

module.exports = router;

