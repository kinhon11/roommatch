const supabase = require('../config/supabaseClient');
const { syncBrokerLeadFromTenantAction } = require('../utils/brokerLeadSync');

const syncBrokerLeadFromChat = async ({ brokerId, tenantId, roomId, note }) => {
  if (!brokerId || !tenantId || !roomId) return;
  const result = await syncBrokerLeadFromTenantAction({
    brokerId,
    tenantId,
    roomId,
    status: 'consulted',
    note,
  });
  if (result?.error) {
    console.warn('Failed to sync broker lead from chat:', result.error.message);
  }
};

/**
 * @desc  Lấy hoặc tạo conversation giữa tenant và landlord về một phòng
 * @route POST /api/chat/conversations
 */
const getOrCreateConversation = async (req, res) => {
  try {
    const { room_id, landlord_id, occupant_id, tenant_id: requestedTenantId } = req.body;
    const isLandlordRequester = req.user.role === 'landlord' || req.user.role === 'broker';
    const isOccupantChat = Boolean(occupant_id);
    const tenant_id = isLandlordRequester ? requestedTenantId : req.user.id;
    let roomContext = null;

    if (isOccupantChat && (req.user.role !== 'tenant' || !room_id)) {
      return res.status(400).json({ error: 'Chat với người đang ở cần tài khoản tenant và room_id.' });
    }
    if (!isLandlordRequester && !landlord_id && !isOccupantChat) {
      return res.status(400).json({ error: 'Thiếu landlord_id.' });
    }
    if (isLandlordRequester && !tenant_id) {
      return res.status(400).json({ error: 'Missing tenant_id.' });
    }
    if (tenant_id === landlord_id || tenant_id === occupant_id) {
      return res.status(400).json({ error: 'Bạn không thể tự nhắn tin cho chính mình.' });
    }

    // Kiểm tra đã tồn tại chưa
    let verifiedLandlordId = isOccupantChat ? occupant_id : (isLandlordRequester ? req.user.id : landlord_id);
    if (room_id) {
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('id, host_id, broker_id, status, is_hidden')
        .eq('id', room_id)
        .maybeSingle();

      if (roomError) return res.status(400).json({ error: roomError.message });
      if (!room || room.status !== 'approved' || room.is_hidden === true) {
        return res.status(404).json({ error: 'Room not found or not public.' });
      }
      roomContext = room;
      const responsibleUserId = room.broker_id || room.host_id;
      if (isOccupantChat) {
        const { data: occupantRequest, error: occupantError } = await supabase
          .from('roommate_requests')
          .select('id, tenant_id, status, tenant:users!tenant_id (id, role, is_locked)')
          .eq('room_id', room_id)
          .eq('tenant_id', occupant_id)
          .eq('status', 'accepted')
          .maybeSingle();

        if (occupantError) return res.status(400).json({ error: occupantError.message });
        if (!occupantRequest || occupantRequest.tenant?.role !== 'tenant' || occupantRequest.tenant?.is_locked === true) {
          return res.status(404).json({ error: 'Không tìm thấy người đang ở hợp lệ để nhắn tin.' });
        }
      } else if (responsibleUserId !== verifiedLandlordId) {
        return res.status(400).json({ error: 'Landlord does not match this room.' });
      }
      if (!isOccupantChat) verifiedLandlordId = responsibleUserId;
    } else {
      const { data: landlord, error: landlordError } = await supabase
        .from('users')
        .select('id, role, is_locked')
        .eq('id', landlord_id)
        .maybeSingle();

      if (landlordError) return res.status(400).json({ error: landlordError.message });
      if (!landlord || !['landlord', 'broker'].includes(landlord.role) || landlord.is_locked === true) {
        return res.status(404).json({ error: 'Valid contact person not found.' });
      }
    }

    if (isLandlordRequester) {
      const { data: tenant, error: tenantError } = await supabase
        .from('users')
        .select('id, role, is_locked')
        .eq('id', tenant_id)
        .maybeSingle();

      if (tenantError) return res.status(400).json({ error: tenantError.message });
      if (!tenant || tenant.role !== 'tenant' || tenant.is_locked === true) {
        return res.status(404).json({ error: 'Valid tenant not found.' });
      }
    }

    let query = supabase
      .from('conversations')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('landlord_id', verifiedLandlordId);

    if (room_id) query = query.eq('room_id', room_id);

    const { data: existing } = await query.maybeSingle();

    if (existing) {
      if (!isLandlordRequester && !isOccupantChat && roomContext?.broker_id) {
        await syncBrokerLeadFromChat({
          brokerId: roomContext.broker_id,
          tenantId: tenant_id,
          roomId: room_id,
          note: `Khach mo lai cuoc tro chuyen ve phong "${roomContext.title || room_id}".`,
        });
      }
      return res.status(200).json({ conversation: existing, isNew: false });
    }

    // Tạo mới
    const { data, error } = await supabase
      .from('conversations')
      .insert({ tenant_id, landlord_id: verifiedLandlordId, room_id: room_id || null })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    if (!isLandlordRequester && !isOccupantChat && roomContext?.broker_id) {
      await syncBrokerLeadFromChat({
        brokerId: roomContext.broker_id,
        tenantId: tenant_id,
        roomId: room_id,
        note: `Khach bat dau chat ve phong "${roomContext.title || room_id}".`,
      });
    }
    return res.status(201).json({ conversation: data, isNew: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * @desc  Lấy tất cả conversations của user (cả tenant lẫn landlord)
 * @route GET /api/chat/conversations
 */
const getConversations = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('conversations')
      .select(`
        *,
        tenant:users!tenant_id (id, full_name, avatar_url),
        landlord:users!landlord_id (id, full_name, avatar_url),
        rooms (id, title, city)
      `)
      .or(`tenant_id.eq.${userId},landlord_id.eq.${userId}`)
      .order('last_message_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    // Đánh dấu đối phương
    const enriched = (data || []).map(conv => ({
      ...conv,
      other_user: conv.tenant_id === userId ? conv.landlord : conv.tenant,
      is_tenant: conv.tenant_id === userId,
    }));

    return res.status(200).json({ conversations: enriched });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * @desc  Lấy tin nhắn trong một conversation
 * @route GET /api/chat/conversations/:id/messages
 */
const getMessages = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: convId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    // Kiểm tra quyền truy cập
    const { data: conv } = await supabase
      .from('conversations')
      .select('id, tenant_id, landlord_id, room_id, room:rooms (id, broker_id, title)')
      .eq('id', convId)
      .single();

    if (!conv) return res.status(404).json({ error: 'Conversation không tồn tại.' });
    if (conv.tenant_id !== userId && conv.landlord_id !== userId) {
      return res.status(403).json({ error: 'Bạn không có quyền xem conversation này.' });
    }

    const { data, error } = await supabase
      .from('messages')
      .select(`*, sender:users!sender_id (id, full_name, avatar_url)`)
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })
      .range((page - 1) * limit, page * limit - 1);

    if (error) return res.status(500).json({ error: error.message });

    // Đánh dấu tin nhắn là đã đọc
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('conversation_id', convId)
      .neq('sender_id', userId)
      .eq('is_read', false);

    return res.status(200).json({ messages: data || [], conversation: conv });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * @desc  Gửi tin nhắn mới
 * @route POST /api/chat/conversations/:id/messages
 */
const sendMessage = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: convId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Nội dung tin nhắn không được để trống.' });
    }

    // Kiểm tra quyền
    const { data: conv } = await supabase
      .from('conversations')
      .select('id, tenant_id, landlord_id, room_id, room:rooms (id, broker_id, title)')
      .eq('id', convId)
      .single();

    if (!conv) return res.status(404).json({ error: 'Conversation không tồn tại.' });
    if (conv.tenant_id !== userId && conv.landlord_id !== userId) {
      return res.status(403).json({ error: 'Bạn không có quyền gửi tin nhắn trong conversation này.' });
    }

    // Insert tin nhắn
    const { data: msg, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: convId,
        sender_id: userId,
        content: content.trim(),
      })
      .select(`*, sender:users!sender_id (id, full_name, avatar_url)`)
      .single();

    if (error) return res.status(400).json({ error: error.message });

    // Cập nhật last_message và last_message_at trong conversations
    await supabase
      .from('conversations')
      .update({ last_message: content.trim(), last_message_at: new Date().toISOString() })
      .eq('id', convId);

    if (userId === conv.tenant_id && conv.room?.broker_id) {
      await syncBrokerLeadFromChat({
        brokerId: conv.room.broker_id,
        tenantId: conv.tenant_id,
        roomId: conv.room_id,
        note: `Khach nhan tin ve phong "${conv.room?.title || conv.room_id}". Noi dung gan nhat: ${content.trim().slice(0, 120)}`,
      });
    }

    const recipientId = conv.tenant_id === userId ? conv.landlord_id : conv.tenant_id;
    await supabase.from('notifications').insert({
      user_id: recipientId,
      type: 'message',
      payload: {
        message: `${req.user.full_name || 'Nguoi dung'} sent a new message.`,
        conversation_id: convId,
      },
    });

    return res.status(201).json({ message: msg });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * @desc  Đếm tổng số tin chưa đọc của user
 * @route GET /api/chat/unread-count
 */
const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;

    // Lấy các conversation mà user tham gia
    const { data: convs } = await supabase
      .from('conversations')
      .select('id')
      .or(`tenant_id.eq.${userId},landlord_id.eq.${userId}`);

    if (!convs || convs.length === 0) {
      return res.status(200).json({ unreadCount: 0 });
    }

    const convIds = convs.map(c => c.id);

    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .in('conversation_id', convIds)
      .neq('sender_id', userId)
      .eq('is_read', false);

    return res.status(200).json({ unreadCount: count || 0 });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { getOrCreateConversation, getConversations, getMessages, sendMessage, getUnreadCount };
