const express = require('express');
const router = express.Router();
const { generateDescription } = require('../controllers/aiController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// POST /api/ai/generate-description (Landlord only)
router.post('/generate-description', protect, restrictTo('landlord', 'admin'), generateDescription);

module.exports = router;
