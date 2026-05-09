const supabase = require('../config/supabaseClient');

/**
 * @desc Admin: Get dashboard statistics (enhanced)
 * @route GET /api/admin/stats
 */
const getStats = async (req, res) => {
  try {
    // Get current date for "new users this month" calc
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [
      { count: totalUsers },
      { count: totalRooms },
      { count: pendingRooms },
      { count: approvedRooms },
      { count: rejectedRooms },
      { count: pendingReports },
      { count: newUsersThisMonth },
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('rooms').select('*', { count: 'exact', head: true }),
      supabase.from('rooms').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('rooms').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
      supabase.from('rooms').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
      supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', startOfMonth.toISOString()),
    ]);

    return res.status(200).json({
      totalUsers, totalRooms,
      pendingRooms, approvedRooms, rejectedRooms,
      pendingReports,
      newUsersThisMonth,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};


/**
 * @desc Admin: Get all users (with search support)
 * @route GET /api/admin/users
 */
const getAllUsers = async (req, res) => {
  try {
    const { search } = req.query;
    let query = supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * @desc Admin: Update user role
 * @route PATCH /api/admin/users/:id/role
 */
const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!['tenant', 'landlord', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Role không hợp lệ.' });
    }

    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'You cannot change your own role.' });
    }

    const { data, error } = await supabase
      .from('users')
      .update({ role })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ message: 'Cập nhật role thành công.', user: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * @desc Admin: Lock/unlock user account
 * @route PATCH /api/admin/users/:id/lock
 */
const toggleUserLock = async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'You cannot lock your own account.' });
    }

    // Get current lock status
    const { data: user, error: fetchErr } = await supabase
      .from('users')
      .select('is_locked')
      .eq('id', req.params.id)
      .single();

    if (fetchErr || !user) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng.' });
    }

    const newLocked = !user.is_locked;
    const { data, error } = await supabase
      .from('users')
      .update({ is_locked: newLocked })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({
      message: newLocked ? 'Đã khóa tài khoản.' : 'Đã mở khóa tài khoản.',
      user: data,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * @desc Admin: Get pending rooms
 * @route GET /api/admin/rooms/pending
 */
const getPendingRooms = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('rooms')
      .select('*, users (full_name, email), room_images (image_url, is_primary)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * @desc Admin: Get ALL rooms with optional status filter
 * @route GET /api/admin/rooms
 */
const getAllRooms = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const from = (page - 1) * limit;
    const to = page * limit - 1;

    let query = supabase
      .from('rooms')
      .select('*, users (full_name, email, avatar_url), room_images (image_url, is_primary)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      query = query.eq('status', status);
    }
    if (search) {
      query = query.or(`title.ilike.%${search}%,address.ilike.%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({
      rooms: data || [],
      total: count ?? (data || []).length,
      page: Number(page),
      limit: Number(limit),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * @desc Admin: Get all reports
 * @route GET /api/admin/reports
 */
const getReports = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('reports')
      .select('*, reporter:users!reporter_id (full_name, email), rooms (title)')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * @desc Admin: Handle (resolve/dismiss) a report
 * @route PATCH /api/admin/reports/:id
 */
const handleReport = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['resolved', 'dismissed'].includes(status)) {
      return res.status(400).json({ error: 'Status must be resolved or dismissed.' });
    }

    const { data, error } = await supabase
      .from('reports')
      .update({ status, resolved_at: new Date() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ message: 'Đã xử lý báo cáo.', report: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getStats, getAllUsers, updateUserRole, toggleUserLock,
  getPendingRooms, getAllRooms,
  getReports, handleReport,
};
