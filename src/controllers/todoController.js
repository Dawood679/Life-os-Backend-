const Todo = require('../models/Todo');
const lifeScoreService = require('../services/lifeScoreService');

// create todo
const createTodo = async (req, res) => {
  try {
    const { title, description, priority, dueDate } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Title is required'
      });
    }

    if (!dueDate) {
      return res.status(400).json({
        success: false,
        message: 'Date and time is required'
      });
    }

    const todo = await Todo.create({
      user: req.user._id,
      title,
      description,
      priority,
      dueDate
    });

    try {
      await lifeScoreService.calculateDailyScore(req.user._id);
    } catch (scoreErr) {
      console.error('Life score update error:', scoreErr);
    }

    res.status(201).json({
      success: true,
      message: 'Todo created successfully',
      todo
    });
  } catch (error) {
    console.error('Create todo error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating todo'
    });
  }
};

// get allTodos
const getTodos = async (req, res) => {
  try {
    const todos = await Todo.find({ user: req.user._id })
      .sort({ dueDate: 1 });

    res.json({
      success: true,
      count: todos.length,
      todos
    });
  } catch (error) {
    console.error('Get todos error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching todos'
    });
  }
};

// get singleTodo by userId
const getTodo = async (req, res) => {
  try {
    const { id } = req.params;
    const todo = await Todo.findOne({
      _id: id,
      user: req.user._id
    });

    if (!todo) {
      return res.status(404).json({
        success: false,
        message: 'Todo not found'
      });
    }

    res.json({
      success: true,
      todo
    });
  } catch (error) {
    console.error('Get todo error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching todo'
    });
  }
};

// update
const updateTodo = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, priority, dueDate, isCompleted } = req.body;

    const existing = await Todo.findOne({ _id: id, user: req.user._id });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Todo not found' });
    }

    const updateFields = {};
    if (title !== undefined) updateFields.title = title;
    if (description !== undefined) updateFields.description = description;
    if (priority !== undefined) updateFields.priority = priority;
    if (dueDate !== undefined) updateFields.dueDate = dueDate;
    if (isCompleted !== undefined) {
      updateFields.isCompleted = isCompleted;
      updateFields.completedAt = isCompleted ? new Date() : null;
    }

   if (
      dueDate &&
      new Date(dueDate).getTime() !== new Date(existing.dueDate).getTime()
    ) {
      updateFields.reminderSent = false;
    }

    const todo = await Todo.findOneAndUpdate(
      { _id: id, user: req.user._id },
      updateFields,
      { new: true, runValidators: true }
    );

    try {
      await lifeScoreService.calculateDailyScore(req.user._id);
    } catch (scoreErr) {
      console.error('Life score update error:', scoreErr);
    }

    res.json({
      success: true,
      message: 'Todo updated successfully',
      todo
    });
  } catch (error) {
    console.error('Update todo error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating todo'
    });
  }
};

// delete
const deleteTodo = async (req, res) => {
  try {
    const { id } = req.params;

    const todo = await Todo.findOneAndDelete({
      _id: id,
      user: req.user._id
    });

    if (!todo) {
      return res.status(404).json({
        success: false,
        message: 'Todo not found'
      });
    }

    try {
      await lifeScoreService.calculateDailyScore(req.user._id);
    } catch (scoreErr) {
      console.error('Life score update error:', scoreErr);
    }

    res.json({
      success: true,
      message: 'Todo deleted successfully'
    });
  } catch (error) {
    console.error('Delete todo error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting todo'
    });
  }
};

module.exports = { createTodo, getTodos, getTodo, updateTodo, deleteTodo };