const express = require('express');
const router = express.Router();

const {
  generateRoadmap,
  getRoadmaps,    
  deleteRoadmap,  
} = require('../controllers/roadmapController');

const { protect } = require('../middleware/auth');

router.post('/generate', protect, generateRoadmap); 
router.get('/', protect, getRoadmaps);                
router.delete('/:id', protect, deleteRoadmap);        

module.exports = router;