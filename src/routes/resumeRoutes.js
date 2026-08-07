const express = require('express');
const router = express.Router();
const {
  analyzeResume,
  getResumeAnalyses,
  getResumeAnalysis,
  deleteResumeAnalysis
} = require('../controllers/resumeController');
const { protect } = require('../middleware/auth');
const { resumeFileUpload, validateResumeFile } = require('../middleware/resumeUpload');

// Note: resumeFileUpload is mounted ONLY on this route, so it never
// interferes with express.json() used by the rest of your app.
router.post('/analyze', protect, resumeFileUpload, validateResumeFile, analyzeResume);
router.get('/', protect, getResumeAnalyses);
router.get('/:id', protect, getResumeAnalysis);
router.delete('/:id', protect, deleteResumeAnalysis);

module.exports = router;