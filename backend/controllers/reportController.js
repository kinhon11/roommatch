const supabase = require('../config/supabaseClient');

/**
 * @desc  Tạo báo cáo vi phạm
 * @route POST /api/reports
 */
const createReport = async (req, res) => {
  try {
    const { room_id, reason, description } = req.body;

    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({ error: 'Lý do báo cáo phải có ít nhất 5 ký tự.' });
    }

    const { data, error } = await supabase
      .from('reports')
      .insert({
        reporter_id: req.user.id,
        room_id: room_id || null,
        reason: reason.trim(),
        description: description?.trim() || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json({ message: 'Báo cáo đã được gửi. Chúng tôi sẽ xem xét sớm nhất!', report: data });
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
