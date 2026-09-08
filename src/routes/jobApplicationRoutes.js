const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getJobApplications,
  createJobApplication,
  updateJobApplication,
  updateApplicationStatus,
  deleteJobApplication,
  bulkImportJobApplications,
  getPipelineStats
} = require('../controllers/jobApplicationController');

router.get('/stats', protect, getPipelineStats);
router.post('/bulk-import', protect, bulkImportJobApplications);
router.get('/', protect, getJobApplications);
router.post('/', protect, createJobApplication);
router.put('/:id', protect, updateJobApplication);
router.patch('/:id/status', protect, updateApplicationStatus);
router.delete('/:id', protect, deleteJobApplication);

module.exports = router;
