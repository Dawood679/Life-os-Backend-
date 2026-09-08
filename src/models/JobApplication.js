const mongoose = require('mongoose');

const jobApplicationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    // 1. Applied Date
    appliedDate: {
      type: Date,
      default: Date.now
    },
    // 2. Follow-up Date (Auto defaults to appliedDate + 7 days, editable)
    followUpDate: {
      type: Date,
      default: function () {
        const base = this.appliedDate ? new Date(this.appliedDate) : new Date();
        return new Date(base.getTime() + 7 * 24 * 60 * 60 * 1000);
      }
    },
    // 3. Company Name
    company: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true
    },
    // 4. Job Title / Role
    roleTitle: {
      type: String,
      required: [true, 'Job title or role is required'],
      trim: true
    },
    // 5. Priority
    priority: {
      type: String,
      enum: ['high', 'medium', 'low'],
      default: 'medium'
    },
    // 6. Job Type
    jobType: {
      type: String,
      enum: ['full_time', 'part_time', 'contractual', 'internship', 'freelance'],
      default: 'full_time'
    },
    // 7. Source
    source: {
      type: String,
      enum: ['linkedin', 'bdjobs', 'company_website', 'referral', 'facebook', 'other'],
      default: 'linkedin'
    },
    // 8. Job Link
    jobUrl: {
      type: String,
      trim: true,
      default: ''
    },
    // 9. Status (Pipeline Stage)
    status: {
      type: String,
      enum: ['wishlist', 'applied', 'interviewing', 'offer', 'rejected', 'archived'],
      default: 'applied',
      index: true
    },
    // 10. Interview Date & Notification Preference
    interviewDate: {
      type: Date
    },
    notificationPref: {
      type: String,
      enum: ['in_app', 'email', 'both', 'none'],
      default: 'in_app'
    },
    // 11. Salary Range
    salaryRange: {
      type: String,
      trim: true,
      default: ''
    },
    // 12. Location
    location: {
      type: String,
      enum: ['remote', 'hybrid', 'onsite'],
      default: 'remote'
    },
    locationDetail: {
      type: String,
      trim: true,
      default: ''
    },
    // 13. Contact Email
    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: ''
    },
    // 14. Networking Contact
    networking: {
      personName: { type: String, trim: true, default: '' },
      profileUrl: { type: String, trim: true, default: '' },
      notes: { type: String, trim: true, default: '' }
    },
    // 15. Structured Rejection Reason
    rejectionReason: {
      category: {
        type: String,
        enum: [
          'dsa_round',
          'system_design',
          'technical_depth',
          'culture_fit',
          'experience_mismatch',
          'salary_mismatch',
          'no_response_ghosted',
          'other',
          'none'
        ],
        default: 'none'
      },
      details: {
        type: String,
        trim: true,
        default: ''
      }
    },
    // 16. Job Description / Circular Notes (Used for AI Mock Interview Bridge)
    jobDescription: {
      type: String,
      trim: true,
      default: ''
    },
    notes: {
      type: String,
      trim: true,
      default: ''
    },
    orderIndex: {
      type: Number,
      default: 0
    },
    stageHistory: [
      {
        fromStatus: { type: String },
        toStatus: { type: String },
        changedAt: { type: Date, default: Date.now }
      }
    ]
  },
  {
    timestamps: true
  }
);

// Compound index to accelerate user queries and duplicate key checks
jobApplicationSchema.index({ user: 1, company: 1, roleTitle: 1 });

const JobApplication = mongoose.model('JobApplication', jobApplicationSchema);

module.exports = JobApplication;
