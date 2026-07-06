const User = require("../models/User");

const createProfile = async (req, res) => {
  try {
    const {
      phone,
      bio,
      avatar,
      dateOfBirth,
      gender,
      institution,
      degree,
      major,
      studentId,
      graduationYear,
      jobTitle,
      company,
      experience,
      skills,
      linkedin,
      github,
      twitter,
      website,
      country,
      city,
    } = req.body;

    const updateData = {
      phone,
      bio,
      avatar,
      dateOfBirth,
      gender,
      institution,
      degree,
      major,
      studentId,
      graduationYear,
      jobTitle,
      company,
      experience,
      skills,
      linkedin,
      github,
      twitter,
      website,
      country,
      city,
    };

    const user = await User.findByIdAndUpdate(req.user._id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(201).json({
      success: true,
      message: "Profile created successfully",
      user,
    });
  } catch (error) {
    console.error("Create profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error creating profile",
    });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching profile",
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    const {
      name,
      phone,
      bio,
      avatar,
      dateOfBirth,
      gender,
      institution,
      degree,
      major,
      studentId,
      graduationYear,
      jobTitle,
      company,
      experience,
      skills,
      linkedin,
      github,
      twitter,
      website,
      country,
      city,
    } = req.body;

    const updateData = {
      name,
      phone,
      bio,
      avatar,
      dateOfBirth,
      gender,
      institution,
      degree,
      major,
      studentId,
      graduationYear,
      jobTitle,
      company,
      experience,
      skills,
      linkedin,
      github,
      twitter,
      website,
      country,
      city,
    };

    const user = await User.findByIdAndUpdate(req.user._id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      message: "Profile updated successfully",
      user,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating profile",
    });
  }
};

const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Please provide current and new password",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters",
      });
    }

    if (!/\d/.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message: "New password must contain at least one number",
      });
    }

    const user = await User.findById(req.user._id).select("+password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error("Update password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating password",
    });
  }
};

module.exports = { createProfile, getProfile, updateProfile, updatePassword };
