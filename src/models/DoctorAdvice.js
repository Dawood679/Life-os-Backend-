const mongoose = require("mongoose");

const doctorAdviceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    prescriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Prescription",
      default: null,
    },
    prescription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Prescription",
      default: null,
    },
    category: {
      type: String,
      enum: ["exercise", "diet_restriction", "lifestyle", "general"],
      default: "general",
    },
    instruction: {
      type: String,
      required: true,
      trim: true,
    },
    isDailyTask: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ["active", "completed", "archived"],
      default: "active",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("DoctorAdvice", doctorAdviceSchema);
