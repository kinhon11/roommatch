const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getFavorites, checkFavorite, addFavorite, removeFavorite } = require('../controllers/favoriteController');

router.use(protect); // Tất cả cần đăng nhập

router.get('/',                       getFavorites);    // GET  /api/favorites
router.get('/:roomId/check',          checkFavorite);   // GET  /api/favorites/:roomId/check
router.post('/:roomId',               addFavorite);     // POST /api/favorites/:roomId
router.delete('/:roomId',             removeFavorite);  // DELETE /api/favorites/:roomId

module.exports = router;
