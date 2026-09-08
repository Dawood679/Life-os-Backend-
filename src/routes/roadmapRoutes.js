const express = require('express');
const router = express.Router();

const {
  generateRoadmap,
  getRoadmaps,    
  deleteRoadmap,
  toggleMilestone,
  bridgeMilestoneToTodo,
} = require('../controllers/roadmapController');

const { protect } = require('../middleware/auth');

router.post('/generate', protect, generateRoadmap); 
router.get('/', protect, getRoadmaps);                
router.delete('/:id', protect, deleteRoadmap);        
router.patch('/:id/phases/:phaseNumber/milestones/:milestoneId/toggle', protect, toggleMilestone);
router.post('/:id/phases/:phaseNumber/milestones/:milestoneId/bridge-todo', protect, bridgeMilestoneToTodo);

module.exports = router;