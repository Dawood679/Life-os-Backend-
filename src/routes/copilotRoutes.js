const express = require('express');
const router = express.Router();
const { handleCopilotCommand, confirmAction, submitStudyTaskQuiz } = require('../controllers/copilotController');
const { protect } = require('../middleware/auth');
const { copilotLimiter } = require('../middleware/rateLimiter');

// POST /api/copilot/command (Rate limited to 15 req/min per IP)
router.post('/command', protect, copilotLimiter, handleCopilotCommand);

// POST /api/copilot/confirm-action (Two-Phase Commit execution)
router.post('/confirm-action', protect, confirmAction);

// POST /api/copilot/submit-study-quiz (Active recall micro-quiz submission)
router.post('/submit-study-quiz', protect, submitStudyTaskQuiz);

module.exports = router;
