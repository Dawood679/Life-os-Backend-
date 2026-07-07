const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const {
  register,
  verifyEmail,
  login,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
  verifyLoginOTP,
  verifyForgotOTP,
} = require("../controllers/authController");
const { protect } = require("../middleware/auth");
const { authLimiter, otpLimiter } = require('../middleware/rateLimiter');

// Validation rules
const registerValidation = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("email")
    .isEmail()
    .withMessage("Valid email is required")
    .normalizeEmail(),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters")
    .matches(/\d/)
    .withMessage("Password must contain a number"),
];

const loginValidation = [
  body("email")
    .isEmail()
    .withMessage("Valid email is required")
    .normalizeEmail(),
  body("password").notEmpty().withMessage("Password is required"),
];

// Public routes
router.post("/register", registerValidation, authLimiter, register);
router.post("/login", loginValidation,authLimiter, login);
router.get("/verify-email/:token", verifyEmail);
router.post("/verify-login-otp", otpLimiter, verifyLoginOTP);
router.post("/logout", logout);
router.post(
  "/forgot-password",
  body("email").isEmail().normalizeEmail(),
  forgotPassword,
);
router.post("/verify-forgot-otp",otpLimiter, verifyForgotOTP);
router.post("/reset-password",otpLimiter, resetPassword);

// Protected routes
router.get("/me", protect, getMe);

module.exports = router;
