const supabase = require('../config/supabaseClient');

/**
 * Helper: Create a notification record
 */
const createNotification = async (userId, type, payload) => {
  try {
    await supabase.from('notifications').insert({ user_id: userId, type, payload });
  } catch (e) {
    console.warn('⚠️ Failed to create notification:', e.message);
  }
};

/**
 * Helper: Get or create conversation between tenant and landlord for a room
 */
const getOrCreateConversation = async (roomId, tenantId, landlordId) => {
  // Check existing
  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('room_id', roomId)
    .eq('tenant_id', tenantId)
    .eq('landlord_id', landlordId)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: conv } = await supabase
    .from('conversations')
    .insert({ room_id: roomId, tenant_id: tenantId, landlord_id: landlordId })
    .select('id')
    .single();

  return conv?.id || null;
};

/**
 * @desc Create a roommate request (Tenant) — with message, move_in_date, occupants, has_pet
 * @route POST /api/roommate-requests
 */
const createRoommateRequest = async (req, res) => {
  try {
    const { room_id, message, move_in_date, occupants = 1, has_pet = false } = req.body;
    if (!room_id) return res.status(400).json({ error: 'room_id is required.' });

    // Get room info
    const { data: room } = await supabase
      .from('rooms')
      .select('host_id, title, available_slots, status, is_hidden, is_available')
      .eq('id', room_id)
      .single();
    if (!room) return res.status(404).json({ error: 'Phòng không tồn tại.' });

    // Chủ nhà không được tự gửi yêu cầu vào phòng của mình
    if (room.host_id === req.user.id) {
      return res.status(400).json({ error: 'Bạn không thể gửi yêu cầu ở ghép vào phòng của chính mình.' });
    }

    // Chỉ cho phép với phòng đã duyệt
    if (room.status !== 'approved') {
      return res.status(400).json({ error: 'Phòng chưa được duyệt.' });
    }

    // Kiểm tra còn chỗ
    if (room.is_hidden === true || room.is_available === false) {
      return res.status(400).json({ error: 'This room is not accepting roommate requests.' });
    }

    if (typeof room.available_slots === 'number' && room.available_slots <= 0) {
      return res.status(400).json({ error: 'Phòng đã hết chỗ ở ghép.' });
    }

    // Kiểm tra trùng (pending hoặc accepted)
    const { data: existing } = await supabase
      .from('roommate_requests')
      .select('id, status')
      .eq('room_id', room_id)
      .eq('tenant_id', req.user.id)
      .in('status', ['pending', 'accepted'])
      .maybeSingle();
    if (existing) {
      return res.status(409).json({ error: 'Bạn đã gửi yêu cầu ở ghép cho phòng này rồi.' });
    }

    // Tạo request
    const { data, error } = await supabase
      .from('roommate_requests')
      .insert({
        room_id,
        tenant_id: req.user.id,
        status: 'pending',
        message: message?.trim() || null,
        move_in_date: move_in_date || null,
        occupants: Number(occupants) || 1,
        has_pet: !!has_pet,
      })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    // Thông báo cho landlord
    const tenantName = req.user.full_name || req.user.email;
    await createNotification(room.host_id, 'request', {
      message: `🤝 ${tenantName} gửi yêu cầu ở ghép cho phòng "${room.title}"`,
      request_id: data.id,
      room_id,
    });

    return res.status(201).json({ message: 'Yêu cầu ở ghép đã gửi thành công.', request: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * @desc Landlord updates request status (accept/reject) — with rejection_reason, auto-create conversation
 * @route PATCH /api/roommate-requests/:id
 */
const updateRoommateRequestStatus = async (req, res) => {
  try {
    const { status, rejection_reason } = req.body;
    if (!['accepted', 'rejected'].includes(status))
      return res.status(400).json({ error: 'Status phải là accepted hoặc rejected.' });

    // Get request info
    const { data: request } = await supabase
      .from('roommate_requests')
      .select('room_id, tenant_id, status')
      .eq('id', req.params.id)
      .single();
    if (!request) return res.status(404).json({ error: 'Yêu cầu không tồn tại.' });

    // Verify ownership
    const { data: room } = await supabase
      .from('rooms')
      .select('host_id, title, available_slots')
      .eq('id', request.room_id)
      .single();
    if (!room || room.host_id !== req.user.id)
      return res.status(403).json({ error: 'Bạn không có quyền xử lý yêu cầu này.' });

    // Chỉ xử lý pending
    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Yêu cầu này đã được xử lý rồi.' });
    }

    if (status === 'accepted' && Number(room.available_slots) <= 0) {
      return res.status(400).json({ error: 'No roommate slots are available for this room.' });
    }

    // Update
    const updateData = { status };
    if (status === 'rejected' && rejection_reason) {
      updateData.rejection_reason = rejection_reason.trim();
    }

    const { data, error } = await supabase
      .from('roommate_requests')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });

    // Thông báo cho tenant
    const statusText = status === 'accepted' ? 'chấp nhận ✅' : 'từ chối ❌';
    await createNotification(request.tenant_id, 'request', {
      message: `🤝 Yêu cầu ở ghép tại "${room.title}" đã được ${statusText}`,
      request_id: req.params.id,
      room_id: request.room_id,
    });

    // Nếu accepted: tạo/lấy conversation để tenant và landlord chat
    let conversationId = null;
    if (status === 'accepted') {
      conversationId = await getOrCreateConversation(request.room_id, request.tenant_id, room.host_id);
    }

    return res.status(200).json({
      message: `Đã ${statusText} yêu cầu.`,
      request: data,
      conversation_id: conversationId,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * @desc Tenant cancels own pending request
 * @route DELETE /api/roommate-requests/:id
 */
const cancelRoommateRequest = async (req, res) => {
  try {
    const { data: request } = await supabase
      .from('roommate_requests')
      .select('tenant_id, status')
      .eq('id', req.params.id)
      .single();

    if (!request) return res.status(404).json({ error: 'Yêu cầu không tồn tại.' });
    if (request.tenant_id !== req.user.id)
      return res.status(403).json({ error: 'Bạn không có quyền hủy yêu cầu này.' });
    if (request.status !== 'pending')
      return res.status(400).json({ error: 'Chỉ có thể hủy yêu cầu đang chờ xử lý.' });

    const { error } = await supabase
      .from('roommate_requests')
      .delete()
      .eq('id', req.params.id);

    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ message: 'Đã hủy yêu cầu ở ghép.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * @desc List roommate requests
 *       - Tenant: own requests with room info
 *       - Landlord: all requests for their rooms with tenant info
 * @route GET /api/roommate-requests?roomId=xxx
 */
const getRoommateRequests = async (req, res) => {
  try {
    const { roomId } = req.query;
    let query = supabase
      .from('roommate_requests')
      .select(`
        *,
        tenant:users!tenant_id (id, full_name, phone, avatar_url, email),
        room:rooms!room_id (id, title, city, address, price, available_slots, host_id,
          room_images (image_url, is_primary))
      `)
      .order('created_at', { ascending: false });

    if (roomId) {
      // Landlord queries by room
      const { data: room } = await supabase
        .from('rooms')
        .select('host_id')
        .eq('id', roomId)
        .single();
      if (!room || room.host_id !== req.user.id)
        return res.status(403).json({ error: 'Bạn không có quyền xem yêu cầu cho phòng này.' });
      query = query.eq('room_id', roomId);
    } else {
      if (req.user.role === 'tenant') {
        query = query.eq('tenant_id', req.user.id);
      } else if (req.user.role === 'landlord') {
        const { data: myRooms } = await supabase
          .from('rooms')
          .select('id')
          .eq('host_id', req.user.id);
        const roomIds = (myRooms || []).map(r => r.id);
        if (!roomIds.length) return res.status(200).json([]);
        query = query.in('room_id', roomIds);
      }
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * @desc Check tenant's request status for a specific room
 * @route GET /api/roommate-requests/check/:roomId
 */
const checkRequestStatus = async (req, res) => {
  try {
    const { data } = await supabase
      .from('roommate_requests')
      .select('id, status, rejection_reason, created_at')
      .eq('room_id', req.params.roomId)
      .eq('tenant_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return res.status(200).json({ request: data || null });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  createRoommateRequest,
  updateRoommateRequestStatus,
  cancelRoommateRequest,
  getRoommateRequests,
  checkRequestStatus,
};
