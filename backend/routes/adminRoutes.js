const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/broker-dashboard', restrictTo('broker'), adminController.getBrokerDashboard);

router.use(restrictTo('admin'));

router.get('/stats', adminController.getStats);
router.get('/users', adminController.getAllUsers);
router.get('/brokers', adminController.getBrokers);
router.get('/activity-logs', adminController.getActivityLogs);
router.patch('/users/:id/role', adminController.updateUserRole);
router.patch('/users/:id/lock', adminController.toggleUserLock);
router.get('/rooms/pending', adminController.getPendingRooms);
router.get('/rooms', adminController.getAllRooms);
router.patch('/rooms/:id/broker', adminController.assignRoomBroker);
router.get('/reports', adminController.getReports);
router.patch('/reports/:id', adminController.handleReport);

module.exports = router;
