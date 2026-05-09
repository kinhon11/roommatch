const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// All admin routes are protected and require admin role
router.use(protect, restrictTo('admin'));

router.get('/stats', adminController.getStats);
router.get('/users', adminController.getAllUsers);
router.patch('/users/:id/role', adminController.updateUserRole);
router.patch('/users/:id/lock', adminController.toggleUserLock);
router.get('/rooms/pending', adminController.getPendingRooms);
router.get('/rooms', adminController.getAllRooms);
router.get('/reports', adminController.getReports);
router.patch('/reports/:id', adminController.handleReport);

module.exports = router;
