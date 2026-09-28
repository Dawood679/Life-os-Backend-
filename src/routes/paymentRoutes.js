const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const {
  createCheckoutSession,
  handleStripeWebhook,
  verifyCheckoutSession,
  getSubscriptionStatus
} = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');

// Optional auth helper so guests or logged-in users can initiate checkout
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
    }
  } catch (err) {
    // Continue as guest
  }
  next();
};

router.post('/create-checkout-session', optionalAuth, createCheckoutSession);
router.get('/verify-session', optionalAuth, verifyCheckoutSession);
router.post('/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);
router.get('/status', protect, getSubscriptionStatus);

module.exports = router;
