const express = require('express');
const router = express.Router();
const { generateDescription, analyzeListing, summarizeReviews, assistantChat } = require('../controllers/aiController');
const { protect, restrictTo, optionalAuth } = require('../middleware/authMiddleware');
const { createAIRateLimiter } = require('../middleware/aiRateLimit');

const generateRateLimit = createAIRateLimiter({ scope: 'ai:generate-description' });
const analyzeRateLimit = createAIRateLimiter({ scope: 'ai:analyze-listing' });
const reviewSummaryRateLimit = createAIRateLimiter({ scope: 'ai:review-summary' });
const assistantRateLimit = createAIRateLimiter({ scope: 'ai:assistant' });

// POST /api/ai/generate-description (Landlord only)
router.post('/generate-description', protect, restrictTo('landlord', 'admin'), generateRateLimit, generateDescription);
router.post('/analyze-listing', protect, restrictTo('landlord', 'admin'), analyzeRateLimit, analyzeListing);
router.post('/review-summary', reviewSummaryRateLimit, summarizeReviews);
router.post('/assistant', optionalAuth, assistantRateLimit, assistantChat);

module.exports = router;
