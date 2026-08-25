const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 8,
      select: false,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: String,
    emailVerificationExpires: Date,

    passwordResetToken: String,
    passwordResetExpires: Date,
    loginOTP: {
      type: String,
      select: false,
    },
    loginOTPExpires: Date,

    forgotOTP: {
      type: String,
      select: false,
    },
    forgotOTPExpires: Date,
    isForgotOTPVerified: {
      type: Boolean,
      default: false,
    },
    phone: {
      type: String,
      trim: true,
    },
    bio: {
      type: String,
      maxlength: [500, "Bio cannot be more than 500 characters"],
    },
    avatar: {
      type: String,
      default: "",
    },
    dateOfBirth: {
      type: Date,
    },
    gender: {
      type: String,
      enum: ["male", "female", "other", "prefer not to say"],
    },

    institution: { type: String, trim: true },
    degree: { type: String, trim: true },
    major: { type: String, trim: true },
    studentId: { type: String, trim: true },
    graduationYear: { type: Number },

    jobTitle: { type: String, trim: true },
    company: { type: String, trim: true },
    experience: { type: Number },
    skills: [{ type: String, trim: true }],

    linkedin: { type: String, trim: true },
    github: { type: String, trim: true },
    twitter: { type: String, trim: true },
    website: { type: String, trim: true },

    country: { type: String, trim: true },
    city: { type: String, trim: true },

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    timezone: {
      type: String,
      default: 'UTC',
      required: true
    },
    
    waterSettings: {
      isActive: { type: Boolean, default: false },
      targetMl: { type: Number, default: 2000 },
      wakeTime: { type: String, default: '08:00' }, // 'HH:MM'
      sleepTime: { type: String, default: '22:00' }, // 'HH:MM'
      intervalHours: { type: Number, default: 2 },
      isEmailAlertEnabled: { type: Boolean, default: false }
    },

    // Phase 1: Universal LifeOS & Focus Settings
    focusMode: {
      type: String,
      enum: ['balanced', 'career_sprint', 'student_exam', 'custom'],
      default: 'balanced'
    },
    focusWeights: {
      health: { type: Number, default: 0.35 },
      learning: { type: Number, default: 0.40 },
      career: { type: Number, default: 0.25 }
    },
    primaryDomain: {
      type: String,
      default: 'general'
    },
    focusGoal: {
      type: String,
      default: ''
    },
    verifiedSkills: [
      {
        skill: { type: String, required: true, trim: true },
        category: { type: String, default: 'general' },
        score: { type: Number, min: 0, max: 100 },
        source: { type: String, default: 'quiz' }, // 'quiz' | 'work_review' | 'assessment'
        verifiedAt: { type: Date, default: Date.now }
      }
    ],
    dashboardWidgets: {
      type: [String],
      default: ['life_score', 'todays_focus', 'health_tracker', 'learning_hub', 'todos']
    },
    streak: {
      current: { type: Number, default: 0 },
      longest: { type: Number, default: 0 },
      lastActiveDate: { type: String, default: '' } // 'YYYY-MM-DD'
    }
  },
  {
    timestamps: true,
  },
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);