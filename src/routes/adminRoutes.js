const express = require('express');
const router = express.Router();
const {
  getAdminOverviewStats,
  getAllUsers,
  getUserDetails,
  updateUserRole,
  updateUserStatus,
  deleteUser,
  getAiUsageMetrics,
  getProductTelemetryMetrics,
  getFeatureFlags,
  updateFeatureFlags,
  sendBroadcastAnnouncement,
  getBroadcastHistory,
  getAdminAuditLogs
} = require('../controllers/adminController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');

// All admin routes require authentication and admin role
router.use(protect, authorize('admin'));

// Platform, AI & Product Telemetry
router.get('/stats', getAdminOverviewStats);
router.get('/metrics/ai-usage', getAiUsageMetrics);
router.get('/metrics/product-telemetry', getProductTelemetryMetrics);

// User Management
router.get('/users', getAllUsers);
router.get('/users/:id', getUserDetails);
router.patch('/users/:id/role', updateUserRole);
router.patch('/users/:id/status', updateUserStatus);
router.delete('/users/:id', deleteUser);

// System Operations & Feature Flags
router.get('/system/flags', getFeatureFlags);
router.put('/system/flags', updateFeatureFlags);

// Global In-App Broadcasts
router.post('/system/broadcast', sendBroadcastAnnouncement);
router.get('/system/broadcasts', getBroadcastHistory);

// Security Audit Log Ledger
router.get('/system/audit-logs', getAdminAuditLogs);

module.exports = router;