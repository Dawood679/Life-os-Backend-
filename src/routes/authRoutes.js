const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  register,
  verifyEmail,
  login,
  logout,
  getMe,
  forgotPassword,
  resetPassword
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Validation rules
const registerValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required'),
  body('email')
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/\d/)
    .withMessage('Password must contain a number')
];

const loginValidation = [
  body('email')
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Public routes
router.post('/register', registerValidation, register);
router.get('/verify-email/:token', verifyEmail);
router.post('/login', loginValidation, login);
router.post('/logout', logout);
router.post('/forgot-password', body('email').isEmail(), forgotPassword);
router.post('/reset-password/:token', body('password').isLength({ min: 8 }), resetPassword);

// Protected routes
router.get('/me', protect, getMe);

module.exports = router;