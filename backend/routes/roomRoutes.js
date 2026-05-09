const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const { protect, optionalAuth, restrictTo } = require('../middleware/authMiddleware');

// Public routes
router.get('/', roomController.getApprovedRooms);
router.get('/my/listings', protect, restrictTo('landlord'), roomController.getMyRooms);
router.get('/landlord/:id/profile', roomController.getLandlordProfile);
router.get('/:id', optionalAuth, roomController.getRoomById);
router.get('/:id/similar', roomController.getSimilarRooms);

// Landlord routes (protected)
router.post('/', protect, restrictTo('landlord'), roomController.createRoom);
router.put('/:id', protect, restrictTo('landlord'), roomController.updateRoom);
router.delete('/:id', protect, restrictTo('landlord', 'admin'), roomController.deleteRoom);
router.patch('/:id/toggle-hidden', protect, restrictTo('landlord'), roomController.toggleRoomHidden);
router.patch('/:id/toggle-available', protect, restrictTo('landlord'), roomController.toggleRoomAvailable);

// Room image management (landlord)
router.delete('/:roomId/images/:imageId', protect, restrictTo('landlord'), roomController.deleteRoomImage);
router.patch('/:roomId/images/:imageId/primary', protect, restrictTo('landlord'), roomController.setPrimaryImage);

// Admin routes
router.patch('/:id/status', protect, restrictTo('admin'), roomController.updateRoomStatus);

// Review routes (authenticated tenants)
router.get('/:id/reviews/eligibility', protect, restrictTo('tenant'), roomController.getReviewEligibility);
router.post('/:id/reviews', protect, restrictTo('tenant'), roomController.createReview);
router.put('/:id/reviews/:reviewId', protect, restrictTo('tenant'), roomController.updateReview);
router.delete('/:id/reviews/:reviewId', protect, restrictTo('tenant', 'admin'), roomController.deleteReview);

module.exports = router;
