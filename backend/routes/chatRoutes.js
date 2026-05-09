const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getOrCreateConversation,
  getConversations,
  getMessages,
  sendMessage,
  getUnreadCount,
} = require('../controllers/chatController');

// Tất cả routes cần đăng nhập
router.use(protect);

router.post('/conversations',                    getOrCreateConversation); // POST   /api/chat/conversations
router.get('/conversations',                     getConversations);        // GET    /api/chat/conversations
router.get('/conversations/:id/messages',        getMessages);             // GET    /api/chat/conversations/:id/messages
router.post('/conversations/:id/messages',       sendMessage);             // POST   /api/chat/conversations/:id/messages
router.get('/unread-count',                      getUnreadCount);          // GET    /api/chat/unread-count

module.exports = router;
