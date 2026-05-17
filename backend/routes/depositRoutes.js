const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { getDeposits, createDeposit, updateDepositStatus } = require('../controllers/depositController');

router.get('/', protect, restrictTo('tenant', 'landlord', 'admin'), getDeposits);
router.post('/', protect, restrictTo('tenant'), createDeposit);
router.patch('/:id/status', protect, restrictTo('tenant', 'landlord', 'admin'), updateDepositStatus);

module.exports = router;
