const supabase = require('../config/supabaseClient');

/**
 * Helper: Create a notification record in DB
 */
const createNotification = async (userId, type, payload) => {
  try {
    await supabase.from('notifications').insert({ user_id: userId, type, payload });
  } catch (e) {
    console.warn('⚠️ Failed to create notification:', e.message);
  }
};

/**
 * @desc Create an appointment (Tenant) — notifies Landlord
 * @route POST /api/appointments
 */
const createAppointment = async (req, res) => {
  try {
    const { room_id, scheduled_at } = req.body;
    if (!room_id || !scheduled_at)
      return res.status(400).json({ error: 'room_id và scheduled_at là bắt buộc.' });

    const scheduledDate = new Date(scheduled_at);
    if (Number.isNaN(scheduledDate.getTime()) || scheduledDate.getTime() < Date.now() + 3600_000) {
      return res.status(400).json({ error: 'Appointment must be at least 1 hour in the future.' });
    }

    const { data: room } = await supabase
      .from('rooms')
      .select('host_id, title, status, is_hidden, is_available')
      .eq('id', room_id)
      .single();
    if (!room) return res.status(404).json({ error: 'Phòng không tồn tại.' });
    if (room.host_id === req.user.id)
      return res.status(400).json({ error: 'Bạn không thể đặt lịch cho phòng của mình.' });

    if (room.status !== 'approved' || room.is_hidden === true || room.is_available === false)
      return res.status(400).json({ error: 'This room is not available for appointments.' });

    const { data, error } = await supabase
      .from('appointments')
      .insert({
        room_id,
        tenant_id:   req.user.id,
        landlord_id: room.host_id,
        scheduled_at,
        status: 'scheduled',
      })
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });

    // Notify landlord
    await createNotification(room.host_id, 'appointment', {
      message: `📅 Có lịch hẹn xem phòng "${room.title}" vào ${new Date(scheduled_at).toLocaleString('vi-VN')}`,
      appointment_id: data.id,
      room_id,
    });

    return res.status(201).json({ message: 'Đặt lịch thành công.', appointment: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * @desc Landlord updates appointment status (completed/cancelled)
 * @route PATCH /api/appointments/:id
 */
const updateAppointmentStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['completed', 'cancelled'].includes(status))
      return res.status(400).json({ error: 'Trạng thái không hợp lệ.' });

    const { data: appointment } = await supabase
      .from('appointments')
      .select('landlord_id, tenant_id, room_id, status')
      .eq('id', req.params.id)
      .single();
    if (!appointment) return res.status(404).json({ error: 'Lịch hẹn không tồn tại.' });

    if (appointment.status !== 'scheduled')
      return res.status(400).json({ error: 'Only scheduled appointments can be updated.' });

    // Allow both landlord and tenant to cancel
    const isLandlord = appointment.landlord_id === req.user.id;
    const isTenant   = appointment.tenant_id   === req.user.id;
    if (status === 'completed' && !isLandlord)
      return res.status(403).json({ error: 'Chỉ chủ nhà mới có thể đánh dấu hoàn thành.' });
    if (status === 'cancelled' && !isLandlord && !isTenant)
      return res.status(403).json({ error: 'Bạn không có quyền hủy lịch hẹn này.' });

    const { data, error } = await supabase
      .from('appointments')
      .update({ status })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });

    // Notify the other party
    const notifyUserId = isLandlord ? appointment.tenant_id : appointment.landlord_id;
    const statusText   = status === 'completed' ? 'hoàn thành' : 'đã bị hủy';
    await createNotification(notifyUserId, 'appointment', {
      message: `📅 Lịch hẹn của bạn đã được ${statusText}`,
      appointment_id: req.params.id,
    });

    return res.status(200).json({ message: 'Cập nhật trạng thái lịch hẹn thành công.', appointment: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * @desc List appointments for tenant or landlord (with room & user details)
 * @route GET /api/appointments
 */
const getAppointments = async (req, res) => {
  try {
    const { tenantId, landlordId } = req.query;
    let query = supabase
      .from('appointments')
      .select(`
        *,
        room:rooms (id, title, address, city),
        tenant:users!tenant_id (id, full_name, phone, avatar_url),
        landlord:users!landlord_id (id, full_name, phone, avatar_url)
      `)
      .order('scheduled_at', { ascending: false });

    if (tenantId) {
      if (tenantId !== req.user.id)
        return res.status(403).json({ error: 'Bạn không được phép xem lịch của người khác.' });
      query = query.eq('tenant_id', tenantId);
    } else if (landlordId) {
      if (landlordId !== req.user.id)
        return res.status(403).json({ error: 'Bạn không được phép xem lịch của người khác.' });
      query = query.eq('landlord_id', landlordId);
    } else {
      if (req.user.role === 'tenant')   query = query.eq('tenant_id',   req.user.id);
      else if (req.user.role === 'landlord') query = query.eq('landlord_id', req.user.id);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { createAppointment, updateAppointmentStatus, getAppointments };
