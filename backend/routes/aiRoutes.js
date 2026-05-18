const express = require('express');
const router = express.Router();
const { generateDescription, analyzeListing, summarizeReviews, assistantChat } = require('../controllers/aiController');
const { protect, restrictTo, optionalAuth } = require('../middleware/authMiddleware');

// POST /api/ai/generate-description (Landlord only)
router.post('/generate-description', protect, restrictTo('landlord', 'admin'), generateDescription);
router.post('/analyze-listing', protect, restrictTo('landlord', 'admin'), analyzeListing);
router.post('/review-summary', summarizeReviews);
router.post('/assistant', optionalAuth, assistantChat);

module.exports = router;
