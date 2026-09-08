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

// All interview routes require authenticated user
router.use(protect);

router.post('/start', startInterview);
router.post('/:id/answer', answerTurn);
router.post('/:id/finalize', finalizeInterview);
router.post('/:id/create-study-plan', createStudyPlanFromWeaknesses);
router.get('/', getInterviews);
router.get('/:id', getInterviewById);
router.delete('/:id', deleteInterview);

module.exports = router;
