const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  startInterview,
  answerTurn,
  finalizeInterview,
  createStudyPlanFromWeaknesses,
  getInterviews,
  getInterviewById,
  deleteInterview
} = require('../controllers/interviewController');

router.post('/start', protect, startInterview);
router.post('/:id/answer', protect, answerTurn);
router.post('/:id/finalize', protect, finalizeInterview);
router.post('/:id/create-study-plan', protect, createStudyPlanFromWeaknesses);
router.get('/', protect, getInterviews);
router.get('/:id', protect, getInterviewById);
router.delete('/:id', protect, deleteInterview);

module.exports = router;
