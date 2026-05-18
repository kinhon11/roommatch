const express = require('express');
const router = express.Router();
const { generateDescription, analyzeListing, summarizeReviews } = require('../controllers/aiController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// POST /api/ai/generate-description (Landlord only)
router.post('/generate-description', protect, restrictTo('landlord', 'admin'), generateDescription);
router.post('/analyze-listing', protect, restrictTo('landlord', 'admin'), analyzeListing);
router.post('/review-summary', summarizeReviews);

module.exports = router;
