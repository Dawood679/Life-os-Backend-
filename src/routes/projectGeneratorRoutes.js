const express = require('express');
const router = express.Router();
const {
  generateProject,
  getProjects,
  getProject,
  deleteProject
} = require('../controllers/projectGeneratorController');
const { protect } = require('../middleware/auth');

router.post('/generate', protect, generateProject);
router.get('/', protect, getProjects);
router.get('/:id', protect, getProject);
router.delete('/:id', protect, deleteProject);

module.exports = router;