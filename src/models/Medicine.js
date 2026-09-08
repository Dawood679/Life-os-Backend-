const mongoose = require("mongoose");

const medicineSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    prescriptionId: { type: mongoose.Schema.Types.ObjectId, ref: "Prescription", default: null },
    name: { type: String, required: true },
    dosage: { type: String, default: "As directed" },
    frequency: { type: String, default: "1+1+1" },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    times: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    
    // NEW: Advanced Reminder Settings
    reminder: {
      enabled: { type: Boolean, default: false },
      type: { 
        type: String, 
        enum: ['everyday', 'specific_days', 'specific_dates'], 
        default: 'everyday' 
      },
      days: { type: [String], default: [] }, // ['Sunday', 'Monday']
      dates: { type: [String], default: [] } // ['2026-08-25', '2026-08-28']
    },
    
    adherenceLogs: [
      {
        date: String,
        status: {
          type: String,
          enum: ["taken", "skipped", "pending"],
          default: "pending",
        },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Medicine", medicineSchema);