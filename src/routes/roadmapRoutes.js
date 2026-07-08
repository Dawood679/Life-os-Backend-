const express = require('express');
const router = express.Router();
const {
  generateRoadmap,
  getRoadmap,
  regenerateRoadmap
} = require('../controllers/roadmapController');
const { protect } = require('../middleware/auth');

router.post('/generate', protect, generateRoadmap);   
router.get('/', protect, getRoadmap);                 
router.post('/regenerate', protect, regenerateRoadmap); 

module.exports = router;