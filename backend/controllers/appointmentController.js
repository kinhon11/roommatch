const supabase = require('../config/supabaseClient');

const ACTIVE_APPOINTMENT_STATUSES = ['pending', 'confirmed'];

const createNotification = async (userId, type, payload) => {
  try {
    await supabase.from('notifications').insert({ user_id: userId, type, payload });
  } catch (e) {
    console.warn('Failed to create notification:', e.message);
  }
};

const hasDuplicateAppointment = async ({ roomId, landlordId, scheduledAt, excludeId }) => {
  let query = supabase
    .from('appointments')
    .select('*', { count: 'exact', head: true })
    .eq('scheduled_at', scheduledAt)
    .or(`room_id.eq.${roomId},landlord_id.eq.${landlordId}`)
    .in('status', ACTIVE_APPOINTMENT_STATUSES);

  if (excludeId) query = query.neq('id', excludeId);

  const { count, error } = await query;
  if (error) throw error;
  return count > 0;
};

const validateFutureAppointmentTime = (scheduledAt) => {
  const scheduledDate = new Date(scheduledAt);
  if (Number.isNaN(scheduledDate.getTime()) || scheduledDate.getTime() < Date.now() + 3600_000) {
    return null;
  }
  return scheduledDate;
};

/**
 * @desc Tenant creates an appointment request.
 * @route POST /api/appointments
 */
const createAppointment = async (req, res) => {
  try {
    const { room_id, scheduled_at } = req.body;
    if (!room_id || !scheduled_at) {
      return res.status(400).json({ error: 'room_id va scheduled_at la bat buoc.' });
    }

    const scheduledDate = validateFutureAppointmentTime(scheduled_at);
    if (!scheduledDate) {
      return res.status(400).json({ error: 'Appointment must be at least 1 hour in the future.' });
    }

    const { data: room } = await supabase
      .from('rooms')
      .select('host_id, broker_id, title, status, is_hidden, is_available')
      .eq('id', room_id)
      .single();

    if (!room) return res.status(404).json({ error: 'Phong khong ton tai.' });
    const responsibleUserId = room.broker_id || room.host_id;
    if (room.host_id === req.user.id || room.broker_id === req.user.id) {
      return res.status(400).json({ error: 'Ban khong the dat lich cho phong cua minh.' });
    }
    if (room.status !== 'approved' || room.is_hidden === true || room.is_available === false) {
      return res.status(400).json({ error: 'This room is not available for appointments.' });
    }

    if (await hasDuplicateAppointment({ roomId: room_id, landlordId: responsibleUserId, scheduledAt: scheduled_at })) {
      return res.status(409).json({ error: 'Khung gio nay da co lich hen cho phong hoac landlord.' });
    }

    const { data, error } = await supabase
      .from('appointments')
      .insert({
        room_id,
        tenant_id: req.user.id,
        landlord_id: responsibleUserId,
        scheduled_at,
        status: 'pending',
      })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    await createNotification(responsibleUserId, 'appointment', {
      message: `Co lich hen xem phong "${room.title}" vao ${scheduledDate.toLocaleString('vi-VN')}`,
      appointment_id: data.id,
      room_id,
    });

    return res.status(201).json({ message: 'Da gui lich hen, dang cho landlord xac nhan.', appointment: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * @desc Landlord/tenant updates appointment lifecycle.
 * @route PATCH /api/appointments/:id
 */
const updateAppointmentStatus = async (req, res) => {
  try {
    const { status, cancellation_reason } = req.body;
    if (!['confirmed', 'completed', 'cancelled', 'no_show'].includes(status)) {
      return res.status(400).json({ error: 'Trang thai khong hop le.' });
    }

    const { data: appointment } = await supabase
      .from('appointments')
      .select('landlord_id, tenant_id, room_id, status')
      .eq('id', req.params.id)
      .single();

    if (!appointment) return res.status(404).json({ error: 'Lich hen khong ton tai.' });
    if (!ACTIVE_APPOINTMENT_STATUSES.includes(appointment.status)) {
      return res.status(400).json({ error: 'Only active appointments can be updated.' });
    }

    const isLandlord = appointment.landlord_id === req.user.id;
    const isTenant = appointment.tenant_id === req.user.id;

    if (['confirmed', 'completed', 'no_show'].includes(status) && !isLandlord) {
      return res.status(403).json({ error: 'Chi landlord moi co quyen cap nhat trang thai nay.' });
    }
    if (status === 'confirmed' && appointment.status !== 'pending') {
      return res.status(400).json({ error: 'Chi lich pending moi duoc xac nhan.' });
    }
    if (['completed', 'no_show'].includes(status) && appointment.status !== 'confirmed') {
      return res.status(400).json({ error: 'Chi lich confirmed moi duoc hoan tat hoac danh dau vang mat.' });
    }
    if (status === 'cancelled' && !isLandlord && !isTenant) {
      return res.status(403).json({ error: 'Ban khong co quyen huy lich hen nay.' });
    }
    if (status === 'cancelled' && !cancellation_reason?.trim()) {
      return res.status(400).json({ error: 'Ly do huy lich la bat buoc.' });
    }

    const { data, error } = await supabase
      .from('appointments')
      .update({
        status,
        cancellation_reason: status === 'cancelled' ? cancellation_reason.trim() : null,
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    const notifyUserId = isLandlord ? appointment.tenant_id : appointment.landlord_id;
    await createNotification(notifyUserId, 'appointment', {
      message: `Lich hen cua ban da cap nhat sang ${status}`,
      appointment_id: req.params.id,
      room_id: appointment.room_id,
    });

    return res.status(200).json({ message: 'Cap nhat lich hen thanh cong.', appointment: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * @desc Tenant or landlord reschedules an active appointment.
 * @route PATCH /api/appointments/:id/reschedule
 */
const rescheduleAppointment = async (req, res) => {
  try {
    const { scheduled_at } = req.body;
    if (!scheduled_at) return res.status(400).json({ error: 'scheduled_at la bat buoc.' });

    const scheduledDate = validateFutureAppointmentTime(scheduled_at);
    if (!scheduledDate) {
      return res.status(400).json({ error: 'Appointment must be at least 1 hour in the future.' });
    }

    const { data: appointment } = await supabase
      .from('appointments')
      .select('id, room_id, landlord_id, tenant_id, status')
      .eq('id', req.params.id)
      .single();

    if (!appointment) return res.status(404).json({ error: 'Lich hen khong ton tai.' });

    const isLandlord = appointment.landlord_id === req.user.id;
    const isTenant = appointment.tenant_id === req.user.id;
    if (!isLandlord && !isTenant) {
      return res.status(403).json({ error: 'Ban khong co quyen doi lich hen nay.' });
    }
    if (!ACTIVE_APPOINTMENT_STATUSES.includes(appointment.status)) {
      return res.status(400).json({ error: 'Chi lich active moi duoc doi lich.' });
    }

    if (await hasDuplicateAppointment({
      roomId: appointment.room_id,
      landlordId: appointment.landlord_id,
      scheduledAt: scheduled_at,
      excludeId: appointment.id,
    })) {
      return res.status(409).json({ error: 'Khung gio nay da co lich hen cho phong hoac landlord.' });
    }

    const { data, error } = await supabase
      .from('appointments')
      .update({
        scheduled_at,
        status: isTenant ? 'pending' : appointment.status,
        rescheduled_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    const notifyUserId = isLandlord ? appointment.tenant_id : appointment.landlord_id;
    await createNotification(notifyUserId, 'appointment', {
      message: `Lich hen xem phong da doi sang ${scheduledDate.toLocaleString('vi-VN')}`,
      appointment_id: req.params.id,
      room_id: appointment.room_id,
    });

    return res.status(200).json({ message: 'Da doi lich hen.', appointment: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * @desc List appointments for tenant or landlord.
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
      if (tenantId !== req.user.id) {
        return res.status(403).json({ error: 'Ban khong duoc xem lich cua nguoi khac.' });
      }
      query = query.eq('tenant_id', tenantId);
    } else if (landlordId) {
      if (landlordId !== req.user.id) {
        return res.status(403).json({ error: 'Ban khong duoc xem lich cua nguoi khac.' });
      }
      query = query.eq('landlord_id', landlordId);
    } else if (req.user.role === 'tenant') {
      query = query.eq('tenant_id', req.user.id);
    } else if (req.user.role === 'landlord' || req.user.role === 'broker') {
      query = query.eq('landlord_id', req.user.id);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { createAppointment, updateAppointmentStatus, rescheduleAppointment, getAppointments };
