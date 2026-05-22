const express = require('express');
const multer = require('multer');
const router = express.Router();
const roomController = require('../controllers/roomController');
const { protect, optionalAuth, restrictTo } = require('../middleware/authMiddleware');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 6 },
});

// Public routes
router.get('/', roomController.getApprovedRooms);
router.get('/my/listings', protect, restrictTo('landlord', 'broker'), roomController.getMyRooms);
router.get('/landlord/:id/profile', roomController.getLandlordProfile);
router.get('/:id', optionalAuth, roomController.getRoomById);
router.get('/:id/similar', roomController.getSimilarRooms);

// Landlord routes (protected)
router.post('/', protect, restrictTo('landlord'), roomController.createRoom);
router.put('/:id', protect, restrictTo('landlord'), roomController.updateRoom);
router.delete('/:id', protect, restrictTo('landlord', 'admin'), roomController.deleteRoom);
router.patch('/:id/toggle-hidden', protect, restrictTo('landlord', 'broker'), roomController.toggleRoomHidden);
router.patch('/:id/toggle-available', protect, restrictTo('landlord', 'broker'), roomController.toggleRoomAvailable);

// Room image management (landlord)
router.post('/:id/images', protect, restrictTo('landlord'), upload.array('images', 6), roomController.uploadRoomImages);
router.delete('/:roomId/images/:imageId', protect, restrictTo('landlord'), roomController.deleteRoomImage);
router.patch('/:roomId/images/:imageId/primary', protect, restrictTo('landlord'), roomController.setPrimaryImage);

// Admin routes
router.patch('/:id/status', protect, restrictTo('admin'), roomController.updateRoomStatus);

// Review routes (authenticated tenants)
router.get('/:id/reviews/eligibility', protect, restrictTo('tenant'), roomController.getReviewEligibility);
router.post('/:id/reviews', protect, restrictTo('tenant'), roomController.createReview);
router.put('/:id/reviews/:reviewId', protect, restrictTo('tenant'), roomController.updateReview);
router.delete('/:id/reviews/:reviewId', protect, restrictTo('tenant', 'admin'), roomController.deleteReview);
router.patch('/:id/reviews/:reviewId/moderation', protect, restrictTo('admin'), roomController.moderateReview);
router.patch('/:id/reviews/:reviewId/response', protect, restrictTo('landlord'), roomController.respondToReview);

module.exports = router;
