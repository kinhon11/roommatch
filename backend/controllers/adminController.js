const supabase = require('../config/supabaseClient');
const { logActivity } = require('../utils/activityLogger');

const APPROVAL_HISTORY_SELECT = `
  id, from_status, to_status, reason, created_at,
  admin:users!room_approval_history_admin_id_fkey (id, full_name, email)
`;

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
      { count: totalBrokers },
      { count: brokerAssignedRooms },
      { count: availableRooms },
      { count: fullRooms },
      { count: acceptedRequests },
      { count: pendingCommissions },
      { count: collectedCommissions },
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('rooms').select('*', { count: 'exact', head: true }),
      supabase.from('rooms').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('rooms').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
      supabase.from('rooms').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
      supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', startOfMonth.toISOString()),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'broker'),
      supabase.from('rooms').select('*', { count: 'exact', head: true }).not('broker_id', 'is', null),
      supabase.from('rooms').select('*', { count: 'exact', head: true }).eq('status', 'approved').eq('is_available', true).gt('available_slots', 0),
      supabase.from('rooms').select('*', { count: 'exact', head: true }).eq('status', 'approved').or('is_available.eq.false,available_slots.lte.0'),
      supabase.from('roommate_requests').select('*', { count: 'exact', head: true }).eq('status', 'accepted'),
      supabase.from('broker_commissions').select('*', { count: 'exact', head: true }).eq('status', 'pending_collection'),
      supabase.from('broker_commissions').select('*', { count: 'exact', head: true }).eq('status', 'collected'),
    ]);

    return res.status(200).json({
      totalUsers, totalRooms,
      pendingRooms, approvedRooms, rejectedRooms,
      pendingReports,
      newUsersThisMonth,
      totalBrokers,
      brokerAssignedRooms,
      availableRooms,
      fullRooms,
      acceptedRequests,
      pendingCommissions,
      collectedCommissions,
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
    if (!['tenant', 'landlord', 'broker', 'admin'].includes(role)) {
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
 * @desc Admin: Get broker users for room assignment
 * @route GET /api/admin/brokers
 */
const getBrokers = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, email, phone, avatar_url, is_locked')
      .eq('role', 'broker')
      .order('full_name', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data || []);
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
      .select(`*, users:users!rooms_host_id_fkey (full_name, email), broker:users!rooms_broker_id_fkey (id, full_name, email, phone), room_images (image_url, is_primary), room_approval_history (${APPROVAL_HISTORY_SELECT})`)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .order('created_at', { foreignTable: 'room_approval_history', ascending: false });

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
      .select(`*, users:users!rooms_host_id_fkey (full_name, email, avatar_url), broker:users!rooms_broker_id_fkey (id, full_name, email, phone), room_images (image_url, is_primary), room_approval_history (${APPROVAL_HISTORY_SELECT})`, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)
      .order('created_at', { foreignTable: 'room_approval_history', ascending: false });

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
 * @desc Admin: Assign or clear a broker for a room
 * @route PATCH /api/admin/rooms/:id/broker
 */
const assignRoomBroker = async (req, res) => {
  try {
    const brokerId = req.body.broker_id || null;
    const { data: existingRoom } = await supabase
      .from('rooms')
      .select('id, broker_id')
      .eq('id', req.params.id)
      .single();

    if (brokerId) {
      const { data: broker, error: brokerError } = await supabase
        .from('users')
        .select('id, role, is_locked')
        .eq('id', brokerId)
        .single();

      if (brokerError || !broker || broker.role !== 'broker') {
        return res.status(400).json({ error: 'Tài khoản được gán phải có vai trò broker.' });
      }
      if (broker.is_locked) {
        return res.status(400).json({ error: 'Không thể gán môi giới đang bị khóa.' });
      }
    }

    const { data, error } = await supabase
      .from('rooms')
      .update({ broker_id: brokerId, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select('*, broker:users!rooms_broker_id_fkey (id, full_name, email, phone)')
      .single();

    if (error) return res.status(400).json({ error: error.message });
    await logActivity({
      actorId: req.user.id,
      action: brokerId ? 'broker_assigned' : 'broker_unassigned',
      targetType: 'room',
      targetId: req.params.id,
      oldValue: { broker_id: existingRoom?.broker_id || null },
      newValue: { broker_id: brokerId },
    });

    return res.status(200).json({
      message: brokerId ? 'Đã phân công môi giới cho phòng.' : 'Đã bỏ phân công môi giới.',
      room: data,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * @desc Broker: Dashboard statistics for assigned rooms
 * @route GET /api/admin/broker-dashboard
 */
const getBrokerDashboard = async (req, res) => {
  try {
    const brokerId = req.user.id;
    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select('id, title, status, is_available, available_slots, city, created_at, room_images (image_url, is_primary)')
      .eq('broker_id', brokerId)
      .order('updated_at', { ascending: false });

    if (roomsError) return res.status(500).json({ error: roomsError.message });

    const roomIds = (rooms || []).map(room => room.id);
    let requests = [];
    let appointments = [];
    let activities = [];
    let leads = [];
    let commissions = [];

    if (roomIds.length) {
      const [requestRes, appointmentRes, activityRes, leadRes, commissionRes] = await Promise.all([
        supabase
          .from('roommate_requests')
          .select('id, room_id, status, occupants, created_at, tenant:users!tenant_id (full_name, phone)')
          .in('room_id', roomIds)
          .order('created_at', { ascending: false })
          .limit(8),
        supabase
          .from('appointments')
          .select('id, room_id, status, scheduled_at, tenant:users!tenant_id (full_name, phone), room:rooms (title)')
          .eq('landlord_id', brokerId)
          .order('scheduled_at', { ascending: true })
          .limit(8),
        supabase
          .from('activity_logs')
          .select('id, action, target_type, target_id, old_value, new_value, created_at')
          .eq('actor_id', brokerId)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('broker_leads')
          .select('id, full_name, phone, status, budget_min, budget_max, preferred_area, updated_at')
          .eq('broker_id', brokerId)
          .order('updated_at', { ascending: false })
          .limit(8),
        supabase
          .from('broker_commissions')
          .select('id, amount, status, created_at, room:rooms (title), lead:broker_leads (full_name)')
          .eq('broker_id', brokerId)
          .order('updated_at', { ascending: false })
          .limit(8),
      ]);

      if (requestRes.error) return res.status(500).json({ error: requestRes.error.message });
      if (appointmentRes.error) return res.status(500).json({ error: appointmentRes.error.message });
      if (activityRes.error) return res.status(500).json({ error: activityRes.error.message });
      if (leadRes.error) return res.status(500).json({ error: leadRes.error.message });
      if (commissionRes.error) return res.status(500).json({ error: commissionRes.error.message });
      requests = requestRes.data || [];
      appointments = appointmentRes.data || [];
      activities = activityRes.data || [];
      leads = leadRes.data || [];
      commissions = commissionRes.data || [];
    } else {
      const [leadRes, commissionRes] = await Promise.all([
        supabase
          .from('broker_leads')
          .select('id, full_name, phone, status, budget_min, budget_max, preferred_area, updated_at')
          .eq('broker_id', brokerId)
          .order('updated_at', { ascending: false })
          .limit(8),
        supabase
          .from('broker_commissions')
          .select('id, amount, status, created_at, room:rooms (title), lead:broker_leads (full_name)')
          .eq('broker_id', brokerId)
          .order('updated_at', { ascending: false })
          .limit(8),
      ]);
      if (leadRes.error) return res.status(500).json({ error: leadRes.error.message });
      if (commissionRes.error) return res.status(500).json({ error: commissionRes.error.message });
      leads = leadRes.data || [];
      commissions = commissionRes.data || [];
    }

    return res.status(200).json({
      stats: {
        assignedRooms: rooms?.length || 0,
        availableRooms: (rooms || []).filter(room => room.status === 'approved' && room.is_available && Number(room.available_slots) > 0).length,
        fullRooms: (rooms || []).filter(room => !room.is_available || Number(room.available_slots) <= 0).length,
        pendingRequests: requests.filter(request => request.status === 'pending').length,
        acceptedRequests: requests.filter(request => request.status === 'accepted').length,
        upcomingAppointments: appointments.filter(appt => ['pending', 'confirmed'].includes(appt.status)).length,
        activeLeads: leads.filter(lead => !['closed', 'lost'].includes(lead.status)).length,
        pendingCommissionAmount: commissions.filter(item => item.status === 'pending_collection').reduce((sum, item) => sum + Number(item.amount || 0), 0),
        collectedCommissionAmount: commissions.filter(item => item.status === 'collected').reduce((sum, item) => sum + Number(item.amount || 0), 0),
      },
      rooms: rooms || [],
      leads,
      requests,
      appointments,
      activities,
      commissions,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * @desc Admin: Recent activity logs
 * @route GET /api/admin/activity-logs
 */
const getActivityLogs = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*, actor:users!activity_logs_actor_id_fkey (id, full_name, email, role)')
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data || []);
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



const COMMISSION_STATUSES = ['pending_collection', 'collected', 'paid_to_broker', 'cancelled'];

/**
 * @desc Admin: List broker commissions
 * @route GET /api/admin/commissions
 */
const getBrokerCommissions = async (req, res) => {
  try {
    const { status } = req.query;
    let query = supabase
      .from('broker_commissions')
      .select(`
        *,
        broker:users!broker_commissions_broker_id_fkey (id, full_name, email, phone),
        tenant:users!broker_commissions_tenant_id_fkey (id, full_name, email, phone),
        lead:broker_leads (id, full_name, phone, status),
        room:rooms (id, title, price, address, city)
      `)
      .order('updated_at', { ascending: false });

    if (status && COMMISSION_STATUSES.includes(status)) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data || []);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * @desc Admin: Update broker commission collection/payment status
 * @route PATCH /api/admin/commissions/:id/status
 */
const updateBrokerCommissionStatus = async (req, res) => {
  try {
    const { status, note } = req.body;
    if (!COMMISSION_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Trang thai hoa hong khong hop le.' });
    }

    const { data: existing } = await supabase
      .from('broker_commissions')
      .select('id, status')
      .eq('id', req.params.id)
      .single();
    if (!existing) return res.status(404).json({ error: 'Hoa hong khong ton tai.' });

    const updatePayload = {
      status,
      note: note?.trim() || null,
      updated_at: new Date().toISOString(),
    };
    if (status === 'collected') updatePayload.collected_at = new Date().toISOString();
    if (status === 'paid_to_broker') {
      updatePayload.paid_at = new Date().toISOString();
      if (existing.status === 'pending_collection') updatePayload.collected_at = new Date().toISOString();
    }
    if (status === 'cancelled') {
      updatePayload.collected_at = null;
      updatePayload.paid_at = null;
    }

    const { data, error } = await supabase
      .from('broker_commissions')
      .update(updatePayload)
      .eq('id', req.params.id)
      .select(`
        *,
        broker:users!broker_commissions_broker_id_fkey (id, full_name, email, phone),
        tenant:users!broker_commissions_tenant_id_fkey (id, full_name, email, phone),
        lead:broker_leads (id, full_name, phone, status),
        room:rooms (id, title, price, address, city)
      `)
      .single();

    if (error) return res.status(400).json({ error: error.message });
    await logActivity({
      actorId: req.user.id,
      action: 'broker_commission_status_updated',
      targetType: 'broker_commission',
      targetId: req.params.id,
      oldValue: { status: existing.status },
      newValue: { status },
    });
    return res.status(200).json({ message: 'Da cap nhat hoa hong.', commission: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getStats, getAllUsers, updateUserRole, toggleUserLock,
  getBrokers, getPendingRooms, getAllRooms, assignRoomBroker, getBrokerDashboard, getActivityLogs,
  getReports,
  getBrokerCommissions,
  updateBrokerCommissionStatus, handleReport,
};
