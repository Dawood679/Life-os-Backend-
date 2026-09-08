const express = require("express");
const router = express.Router();

const {
  updateWaterSettings,
  getLogByDate,
  getLogsInRange,
  addWaterEntry,
  updateScreenTime,
  updateSleep,
  updateMood,
  updateActivity,
  getWaterSettings,
  generateWeeklyReport,
} = require("../controllers/wellnessController");

const { protect } = require("../middleware/auth");

// User settings & config
router.get("/water-settings", protect, getWaterSettings);
router.post("/water-settings", protect, updateWaterSettings);

// AI Weekly Report
router.get("/weekly-report", protect, generateWeeklyReport);

// Wellness log actions
router.get("/logs", protect, getLogsInRange);
router.get("/logs/:date", protect, getLogByDate);
router.post("/water", protect, addWaterEntry);
router.patch("/screen-time", protect, updateScreenTime);
router.patch("/sleep", protect, updateSleep);
router.patch("/mood", protect, updateMood);
router.patch("/activity", protect, updateActivity);

module.exports = router;
