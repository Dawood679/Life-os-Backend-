const mongoose = require("mongoose");

const medicineSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    prescriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Prescription",
      default: null,
    },

    name: { type: String, required: true },
    dosage: {
      type: String,
      default: "As directed",
    },
    frequency: {
      type: String,
      default: "1+1+1", // e.g. morning+noon+night or custom
    },
    startDate: {
      type: String, // YYYY-MM-DD
      required: true,
    },
    endDate: {
      type: String, // YYYY-MM-DD
      required: true,
    },
    times: {
      type: [String], // e.g. ["08:00", "14:00", "21:00"]
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    adherenceLogs: [
      {
        date: String, // YYYY-MM-DD
        status: {
          type: String,
          enum: ["taken", "skipped", "pending"],
          default: "pending",
        },
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Medicine", medicineSchema);
