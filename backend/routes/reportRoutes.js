const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { createReport, getAllReports, resolveReport } = require('../controllers/reportController');

// Tenant: tạo báo cáo
router.post('/', protect, createReport);  // POST /api/reports

// Admin: quản lý báo cáo
router.get('/',     protect, restrictTo('admin'), getAllReports);  // GET    /api/reports
router.patch('/:id', protect, restrictTo('admin'), resolveReport); // PATCH  /api/reports/:id

module.exports = router;
