const supabase = require('../config/supabaseClient');

/**
 * @desc Lấy danh sách thông báo của người dùng (tất cả, có/chưa đọc)
 * @route GET /api/notifications
 */
const getNotifications = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * @desc Đánh dấu một thông báo đã đọc
 * @route PATCH /api/notifications/:id/read
 */
const markNotificationRead = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ message: 'Đánh dấu đã đọc.', notification: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * @desc Đánh dấu TẤT CẢ thông báo chưa đọc là đã đọc
 * @route PATCH /api/notifications/mark-all-read
 */
const markAllNotificationsRead = async (req, res) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', req.user.id)
      .eq('read', false);
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ message: 'Đã đánh dấu tất cả thông báo là đã đọc.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { getNotifications, markNotificationRead, markAllNotificationsRead };

