const rateLimit = require('express-rate-limit');

//auth-10 req for 15 mins
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,                   
  message: {
    success: false,
    message: 'Too many attempts. Please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// otp-10 req for 30 mins
const otpLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Too many OTP requests. Please try again after 30 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// post,patch,delete-15 req per 10 mins
const writeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 15,
  skip: (req) => req.method === 'GET',
  message: {
    success: false,
    message: 'Too many requests. Please try again after 10 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = { authLimiter, otpLimiter, writeLimiter };