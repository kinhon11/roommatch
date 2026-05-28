const supabase = require('../config/supabaseClient');

const AUTO_HIDE_REPORT_THRESHOLD = 3;

/**
 * @desc  Tạo báo cáo vi phạm
 * @route POST /api/reports
 */
const createReport = async (req, res) => {
  try {
    const { room_id, reason, description } = req.body;

    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({ error: 'Ly do bao cao phai co it nhat 5 ky tu.' });
    }
    if (!room_id) {
      return res.status(400).json({ error: 'room_id is required.' });
    }

    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('id, host_id, broker_id, is_hidden')
      .eq('id', room_id)
      .maybeSingle();

    if (roomError) return res.status(400).json({ error: roomError.message });
    if (!room) return res.status(404).json({ error: 'Phong khong ton tai.' });
    if (room.host_id === req.user.id || room.broker_id === req.user.id) {
      return res.status(400).json({ error: 'Ban khong the bao cao phong do minh quan ly.' });
    }

    const { data: existingReport, error: existingError } = await supabase
      .from('reports')
      .select('id')
      .eq('reporter_id', req.user.id)
      .eq('room_id', room_id)
      .in('status', ['pending', 'resolved'])
      .maybeSingle();

    if (existingError) return res.status(400).json({ error: existingError.message });
    if (existingReport) {
      return res.status(409).json({ error: 'Ban da gui bao cao cho phong nay roi.' });
    }

    const { data, error } = await supabase
      .from('reports')
      .insert({
        reporter_id: req.user.id,
        room_id,
        reason: reason.trim(),
        description: description?.trim() || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    const { count } = await supabase
      .from('reports')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', room_id)
      .eq('status', 'pending');

    if ((count || 0) >= AUTO_HIDE_REPORT_THRESHOLD && room.is_hidden !== true) {
      await supabase
        .from('rooms')
        .update({
          is_hidden: true,
          auto_hidden_reason: `Tu dong an do co ${count} bao cao vi pham dang cho xu ly.`,
          hidden_by_report_count: count,
          hidden_at: new Date().toISOString(),
        })
        .eq('id', room_id);
    }

    return res.status(201).json({ message: 'Bao cao da duoc gui. Chung toi se xem xet som nhat!', report: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * @desc  Admin: Lấy tất cả reports
 * @route GET /api/reports (Admin)
 */
const getAllReports = async (req, res) => {
  try {
    const { status = 'pending', page = 1, limit = 20 } = req.query;

    let query = supabase
      .from('reports')
      .select(`
        *,
        users!reporter_id (id, full_name, email),
        rooms (id, title, city)
      `)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (status && status !== 'all') query = query.eq('status', status);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ reports: data, total: data.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * @desc  Admin: Xử lý report (resolve/dismiss)
 * @route PATCH /api/reports/:id
 */
const resolveReport = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['resolved', 'dismissed'].includes(status)) {
      return res.status(400).json({ error: 'Status phải là resolved hoặc dismissed.' });
    }

    const { data, error } = await supabase
      .from('reports')
      .update({
        status,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ message: `Đã ${status === 'resolved' ? 'xử lý' : 'bỏ qua'} báo cáo.`, report: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { createReport, getAllReports, resolveReport };
