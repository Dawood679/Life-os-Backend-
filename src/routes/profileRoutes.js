const express = require("express");
const router = express.Router();
const {
  createProfile,
  getProfile,
  updateProfile,
  updatePassword,
} = require("../controllers/profileController");
const { protect } = require("../middleware/auth");

router.post("/", protect, createProfile);
router.get("/", protect, getProfile);
router.patch("/", protect, updateProfile);
router.patch("/password", protect, updatePassword);

module.exports = router;
