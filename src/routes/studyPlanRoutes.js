const express = require('express');
const router = express.Router();
const {
  generateStudyPlan,
  getStudyPlans,
  getStudyPlan,
  deleteStudyPlan
} = require('../controllers/studyPlanController');
const { protect } = require('../middleware/auth');

router.post('/generate', protect, generateStudyPlan);
router.get('/', protect, getStudyPlans);
router.get('/:id', protect, getStudyPlan);
router.delete('/:id', protect, deleteStudyPlan);

module.exports = router;

