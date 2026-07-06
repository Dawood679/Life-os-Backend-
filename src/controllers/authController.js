const crypto = require('crypto');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const sendEmail = require('../config/email');
const { sendTokenResponse } = require('../utils/generateToken');
const generateOTP = require('../utils/generateOTP');

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
        message: 'Invalid email or password' ,
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

    const { otp, otpExpires } = generateOTP();

    user.loginOTP = otp;
    user.loginOTPExpires = otpExpires;
    await user.save({ validateBeforeSave: false });

    await sendEmail({
      to: user.email,
      subject: 'LIFEOS Login OTP',
      html: `
        <h2>Login Verification Code</h2>
        <p>Your OTP for login is —</p>
        <h1 style="
          font-size: 48px;
          font-weight: bold;
          color: #6366f1;
          letter-spacing: 8px;
          text-align: center;
        ">${otp}</h1>
        <p>This code expires in <strong>10 minutes</strong>.</p>
        <p>If you didn't try to login, please ignore this email.</p>
      `
    });

    res.json({
      success: true,
      message: 'OTP sent to your email. Please verify to complete login.',
      email: user.email
    });


  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during login' 
    });
  }
};

const verifyLoginOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({
      email,
      loginOTPExpires: { $gt: Date.now() } 
    }).select('+loginOTP');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'OTP expired or invalid email'
      });
    }


    if (user.loginOTP !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP'
      });
    }

    user.loginOTP = undefined;
    user.loginOTPExpires = undefined;
    await user.save({ validateBeforeSave: false });

  
    sendTokenResponse(user, 200, res);

  } catch (error) {
    console.error('Verify login OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during OTP verification'
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
        message: 'If that email is registered, you will receive an OTP.'
      });
    }

     const { otp, otpExpires } = generateOTP();

    user.forgotOTP = otp;
    user.forgotOTPExpires = otpExpires;
    user.isForgotOTPVerified = false;
    await user.save({ validateBeforeSave: false });

    await sendEmail({
      to: user.email,
      subject: 'LIFEOS Password Reset OTP',
      html: `
        <h2>Password Reset Code</h2>
        <p>Your OTP for password reset is —</p>
        <h1 style="
          font-size: 48px;
          font-weight: bold;
          color: #6366f1;
          letter-spacing: 8px;
          text-align: center;
        ">${otp}</h1>
        <p>This code expires in <strong>10 minutes</strong>.</p>
        <p>If you didn't request this, ignore this email.</p>
      `
    });

    res.json({
      success: true,
      message: 'If that email is registered, you will receive an OTP.',
      email: user.email
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending OTP'
    });
  }
};

const verifyForgotOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({
      email,
      forgotOTPExpires: { $gt: Date.now() }
    }).select('+forgotOTP');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'OTP expired or invalid email'
      });
    }

    if (user.forgotOTP !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP'
      });
    }

    user.forgotOTP = undefined;
    user.forgotOTPExpires = undefined;
    user.isForgotOTPVerified = true;
    await user.save({ validateBeforeSave: false });

    res.json({
      success: true,
      message: 'OTP verified. You can now reset your password.',
      email: user.email
    });

  } catch (error) {
    console.error('Verify forgot OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during OTP verification'
    });
  }
};

// resetPassword
const resetPassword = async (req, res) => {
  try {
    const { email, password } = req.body; 

    const user = await User.findOne({
      email,
      isForgotOTPVerified: true
    });

    if (!user) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please verify OTP first before resetting password' 
      });
    }

    user.password = password;
     user.isForgotOTPVerified = false;
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
  verifyLoginOTP, 
  logout, 
  getMe, 
  forgotPassword,
  verifyForgotOTP, 
  resetPassword 
};