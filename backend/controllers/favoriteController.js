const supabase = require('../config/supabaseClient');

/**
 * @desc  Lấy danh sách phòng yêu thích của user
 * @route GET /api/favorites
 */
const getFavorites = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('favorites')
      .select(`
        id, created_at,
        rooms (
          id, title, price, address, city, area, status, is_hidden,
          room_images (image_url, is_primary),
          users (full_name, avatar_url)
        )
      `)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    // Lọc ra chỉ trường rooms
    const rooms = data
      .map(f => ({ favorite_id: f.id, ...f.rooms }))
      .filter(room => room.id && room.status === 'approved' && room.is_hidden !== true);
    return res.status(200).json({ favorites: rooms, total: rooms.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * @desc  Kiểm tra phòng đã được yêu thích chưa
 * @route GET /api/favorites/:roomId/check
 */
const checkFavorite = async (req, res) => {
  try {
    const { data } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('room_id', req.params.roomId)
      .maybeSingle();

    return res.status(200).json({ isFavorited: !!data, favoriteId: data?.id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * @desc  Thêm phòng vào yêu thích
 * @route POST /api/favorites/:roomId
 */
const addFavorite = async (req, res) => {
  try {
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('id, status, is_hidden')
      .eq('id', req.params.roomId)
      .maybeSingle();

    if (roomError) return res.status(400).json({ error: roomError.message });
    if (!room || room.status !== 'approved' || room.is_hidden === true) {
      return res.status(404).json({ error: 'Phòng không tồn tại hoặc chưa được công khai.' });
    }

    const { data, error } = await supabase
      .from('favorites')
      .insert({ user_id: req.user.id, room_id: req.params.roomId })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Phòng đã có trong danh sách yêu thích.' });
      }
      return res.status(400).json({ error: error.message });
    }

    return res.status(201).json({ message: 'Đã thêm vào yêu thích!', favorite: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * @desc  Xóa phòng khỏi yêu thích
 * @route DELETE /api/favorites/:roomId
 */
const removeFavorite = async (req, res) => {
  try {
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', req.user.id)
      .eq('room_id', req.params.roomId);

    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ message: 'Đã xóa khỏi yêu thích.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { getFavorites, checkFavorite, addFavorite, removeFavorite };
