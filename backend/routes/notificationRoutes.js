const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getNotifications, markNotificationRead, markAllNotificationsRead } = require('../controllers/notificationController');

// Get all notifications for the authenticated user
router.get('/', protect, getNotifications);

// Mark ALL notifications as read — static route MUST come before dynamic /:id/read
router.patch('/mark-all-read', protect, markAllNotificationsRead);

// Mark a single notification as read
router.patch('/:id/read', protect, markNotificationRead);

module.exports = router;
