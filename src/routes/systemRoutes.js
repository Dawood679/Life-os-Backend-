const express = require('express');
const router = express.Router();
const { getFeatureFlags } = require('../controllers/adminController');

// Public endpoint for frontend clients to read active feature flags
router.get('/flags', getFeatureFlags);

module.exports = router;
