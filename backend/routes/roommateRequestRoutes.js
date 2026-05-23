const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/authMiddleware');
const {
  createRoommateRequest,
  updateRoommateRequestStatus,
  getRoommateRequests,
  cancelRoommateRequest,
  checkRequestStatus,
} = require('../controllers/roommateRequestController');

// Get requests (landlord or tenant)
router.get('/', protect, getRoommateRequests);

// Check tenant's request status for a room
router.get('/check/:roomId', protect, restrictTo('tenant'), checkRequestStatus);

// Tenant creates a request
router.post('/', protect, restrictTo('tenant'), createRoommateRequest);

// Landlord/admin updates request status (accept/reject)
router.patch('/:id', protect, restrictTo('landlord', 'admin'), updateRoommateRequestStatus);

// Tenant cancels own pending request
router.delete('/:id', protect, restrictTo('tenant'), cancelRoommateRequest);

module.exports = router;
