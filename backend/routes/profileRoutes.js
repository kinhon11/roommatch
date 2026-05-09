const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getProfile, updateProfile, changePassword } = require('../controllers/profileController');

// Tất cả routes cần đăng nhập
router.use(protect);

// GET  /api/profile        - Lấy thông tin hồ sơ hiện tại
router.get('/', getProfile);

// PUT  /api/profile        - Cập nhật thông tin hồ sơ
router.put('/', updateProfile);

// PUT  /api/profile/change-password  - Đổi mật khẩu
router.put('/change-password', changePassword);

module.exports = router;
