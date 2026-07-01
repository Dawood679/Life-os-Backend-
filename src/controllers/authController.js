const crypto = require('crypto');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const sendEmail = require('../config/email');
const { sendTokenResponse } = require('../utils/generateToken');

// for registration
const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email already registered' 
      });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = Date.now() + 24 * 60 * 60 * 1000;

    const user = await User.create({
      name,
      email,
      password,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: verificationExpires
    });

    const verifyURL = `${process.env.CLIENT_URL}/verify-email/${verificationToken}`;
    
    await sendEmail({
      to: user.email,
      subject: 'Verify your LIFEOS email',
      html: `
        <h2>Welcome to LIFEOS, ${user.name}!</h2>
        <p>Click the link below to verify your email. This link expires in 24 hours.</p>
        <a href="${verifyURL}" style="
          display: inline-block;
          padding: 12px 24px;
          background: #6366f1;
          color: white;
          border-radius: 6px;
          text-decoration: none;
        ">Verify Email</a>
        <p>Or copy this URL: ${verifyURL}</p>
      `
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email to verify your account.'
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during registration' 
    });
  }
};

// email verify
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired verification link' 
      });
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.json({ 
      success: true, 
      message: 'Email verified successfully. You can now log in.' 
    });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during email verification' 
    });
  }
};

// for login
const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }

    const isPasswordCorrect = await user.comparePassword(password);
    if (!isPasswordCorrect) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email before logging in'
      });
    }

    sendTokenResponse(user, 200, res);

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during login' 
    });
  }
};

// for logout
const logout = (req, res) => {
  res.cookie('token', '', {
    httpOnly: true,
    expires: new Date(0)
  });
  res.json({ success: true, message: 'Logged out successfully' });
};

// get current user
const getMe = async (req, res) => {
  res.json({ success: true, user: req.user });
};

// forgotPassword
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.json({
        success: true,
        message: 'If that email is registered, you will receive a reset link.'
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = resetToken;
    user.passwordResetExpires = Date.now() + 60 * 60 * 1000;
    await user.save({ validateBeforeSave: false });

    const resetURL = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
    
    await sendEmail({
      to: user.email,
      subject: 'LIFEOS password reset',
      html: `
        <h2>Password Reset Request</h2>
        <p>Click the link below. This expires in 1 hour.</p>
        <a href="${resetURL}" style="
          display: inline-block;
          padding: 12px 24px;
          background: #6366f1;
          color: white;
          border-radius: 6px;
          text-decoration: none;
        ">Reset Password</a>
        <p>If you didn't request this, ignore this email.</p>
      `
    });

    res.json({
      success: true,
      message: 'If that email is registered, you will receive a reset link.'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error sending reset email' 
    });
  }
};

// resetPassword
const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired reset token' 
      });
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    sendTokenResponse(user, 200, res);
    
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during password reset' 
    });
  }
};

module.exports = { 
  register, 
  verifyEmail, 
  login, 
  logout, 
  getMe, 
  forgotPassword, 
  resetPassword 
};