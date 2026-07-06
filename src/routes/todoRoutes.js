const express = require('express');
const router = express.Router();
const {
  createTodo,
  getTodos,
  getTodo,
  updateTodo,
  deleteTodo
} = require('../controllers/todoController');
const { protect } = require('../middleware/auth');

router.post('/', protect, createTodo);
router.get('/', protect, getTodos);
router.get('/:id', protect, getTodo);
router.patch('/:id', protect, updateTodo);
router.delete('/:id', protect, deleteTodo);

module.exports = router;