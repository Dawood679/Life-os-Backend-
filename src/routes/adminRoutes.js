const express = require('express');
const router = express.Router();
const { getAllUsers, deleteUser, updateUserRole } = require('../controllers/adminController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');


router.get('/users', protect, authorize('admin'), getAllUsers);
router.delete('/users/:id', protect, authorize('admin'), deleteUser);
router.patch('/users/:id/role', protect, authorize('admin'), updateUserRole);

module.exports = router;