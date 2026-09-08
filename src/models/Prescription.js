const mongoose = require("mongoose");

const prescriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    fileType: {
      type: String,
      enum: ["image", "pdf"],
      required: true,
    },
    doctorName: {
      type: String,
      default: "Unknown Doctor",
    },
    rawText: {
      type: String,
      default: "",
    },
    extractedData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    recordType: {
      type: String,
      enum: ["active", "archive"],
      default: "active",
    },
    illnessSummary: {
      type: String, // A 1-sentence AI summary of this specific record
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Prescription", prescriptionSchema);
