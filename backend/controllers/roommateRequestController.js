const supabase = require('../config/supabaseClient');
const { logActivity } = require('../utils/activityLogger');

/**
 * Helper: Create a notification record
 */
const createNotification = async (userId, type, payload) => {
  try {
    await supabase.from('notifications').insert({ user_id: userId, type, payload });
  } catch (e) {
    console.warn('Failed to create notification:', e.message);
  }
};

/**
 * Helper: Get or create conversation between tenant and landlord for a room
 */
const getOrCreateConversation = async (roomId, tenantId, landlordId) => {
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

const normalizeOccupants = (value) => {
  const occupants = Number(value);
  if (!Number.isInteger(occupants) || occupants <= 0) return null;
  return occupants;
};

/**
 * @desc Create a roommate request (Tenant) with message, move_in_date, occupants, has_pet
 * @route POST /api/roommate-requests
 */
const createRoommateRequest = async (req, res) => {
  try {
    const { room_id, message, move_in_date, occupants = 1, has_pet = false } = req.body;
    if (!room_id) return res.status(400).json({ error: 'room_id is required.' });

    const requestedOccupants = normalizeOccupants(occupants);
    if (!requestedOccupants) {
      return res.status(400).json({ error: 'So nguoi thue phai la so nguyen lon hon 0.' });
    }

    const { data: room } = await supabase
      .from('rooms')
      .select('host_id, broker_id, title, available_slots, status, is_hidden, is_available')
      .eq('id', room_id)
      .single();

    if (!room) return res.status(404).json({ error: 'Ph?ng kh?ng t?n t?i.' });

    if (room.host_id === req.user.id) {
      return res.status(400).json({ error: 'B?n kh?ng th? g?i y?u c?u ? gh?p v?o ph?ng c?a ch?nh m?nh.' });
    }

    if (room.status !== 'approved') {
      return res.status(400).json({ error: 'Ph?ng ch?a ???c duy?t.' });
    }

    if (room.is_hidden === true || room.is_available === false) {
      return res.status(400).json({ error: 'This room is not accepting roommate requests.' });
    }

    const availableSlots = Number(room.available_slots) || 0;
    if (availableSlots <= 0) {
      return res.status(400).json({ error: 'Ph?ng da het cho o ghep.' });
    }
    if (availableSlots < requestedOccupants) {
      return res.status(400).json({
        error: `Ph?ng ch? c?n ${availableSlots} ch? tr?ng, kh?ng ?? cho ${requestedOccupants} nguoi.`,
      });
    }

    const { data: existing } = await supabase
      .from('roommate_requests')
      .select('id, status')
      .eq('room_id', room_id)
      .eq('tenant_id', req.user.id)
      .in('status', ['pending', 'accepted'])
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ error: 'B?n ?? g?i y?u c?u ? gh?p cho ph?ng n?y r?i.' });
    }

    const { data, error } = await supabase
      .from('roommate_requests')
      .insert({
        room_id,
        tenant_id: req.user.id,
        status: 'pending',
        message: message?.trim() || null,
        move_in_date: move_in_date || null,
        occupants: requestedOccupants,
        has_pet: !!has_pet,
      })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    const tenantName = req.user.full_name || req.user.email;
    const responsibleUserId = room.broker_id || room.host_id;
    await createNotification(responsibleUserId, 'request', {
      message: `${tenantName} g?i y?u c?u ? gh?p cho ph?ng "${room.title}"`,
      request_id: data.id,
      room_id,
    });

    return res.status(201).json({ message: 'Y?u c?u ? gh?p ?? g?i th?nh c?ng.', request: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * @desc Landlord updates request status (accept/reject) with rejection_reason, auto-create conversation
 * @route PATCH /api/roommate-requests/:id
 */
const updateRoommateRequestStatus = async (req, res) => {
  try {
    const { status, rejection_reason } = req.body;
    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status phai la accepted hoac rejected.' });
    }

    const { data: request } = await supabase
      .from('roommate_requests')
      .select('room_id, tenant_id, status, occupants')
      .eq('id', req.params.id)
      .single();

    if (!request) return res.status(404).json({ error: 'Y?u c?u kh?ng t?n t?i.' });

    const { data: room } = await supabase
      .from('rooms')
      .select('host_id, broker_id, title, available_slots, is_available')
      .eq('id', request.room_id)
      .single();

    if (!room || (room.host_id !== req.user.id && room.broker_id !== req.user.id)) {
      return res.status(403).json({ error: 'B?n kh?ng c? quy?n x? l? y?u c?u n?y.' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Y?u c?u n?y ?? ???c x? l? r?i.' });
    }

    const acceptedOccupants = normalizeOccupants(request.occupants) || 1;
    const availableSlots = Number(room.available_slots) || 0;

    if (status === 'accepted' && (room.is_available === false || availableSlots <= 0)) {
      return res.status(400).json({ error: 'No roommate slots are available for this room.' });
    }
    if (status === 'accepted' && availableSlots < acceptedOccupants) {
      return res.status(400).json({
        error: `Ph?ng ch? c?n ${availableSlots} ch? tr?ng, kh?ng ?? cho ${acceptedOccupants} nguoi.`,
      });
    }

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

    if (status === 'accepted') {
      const remainingSlots = Math.max(availableSlots - acceptedOccupants, 0);
      const { error: roomUpdateError } = await supabase
        .from('rooms')
        .update({
          available_slots: remainingSlots,
          is_available: remainingSlots > 0,
          last_available_slots: remainingSlots > 0 ? remainingSlots : availableSlots,
        })
        .eq('id', request.room_id);

      if (roomUpdateError) return res.status(400).json({ error: roomUpdateError.message });
    }
    await logActivity({
      actorId: req.user.id,
      action: status === 'accepted' ? 'roommate_request_accepted' : 'roommate_request_rejected',
      targetType: 'roommate_request',
      targetId: req.params.id,
      oldValue: { status: request.status },
      newValue: { status, room_id: request.room_id, occupants: acceptedOccupants },
    });

    const statusText = status === 'accepted' ? 'chap nhan' : 'tu choi';
    await createNotification(request.tenant_id, 'request', {
      message: `Y?u c?u ? gh?p t?i "${room.title}" da duoc ${statusText}`,
      request_id: req.params.id,
      room_id: request.room_id,
    });

    let conversationId = null;
    if (status === 'accepted') {
      conversationId = await getOrCreateConversation(request.room_id, request.tenant_id, room.broker_id || room.host_id);
    }

    return res.status(200).json({
      message: `Da ${statusText} yeu cau.`,
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

    if (!request) return res.status(404).json({ error: 'Y?u c?u kh?ng t?n t?i.' });
    if (request.tenant_id !== req.user.id) {
      return res.status(403).json({ error: 'B?n kh?ng c? quy?n h?y y?u c?u n?y.' });
    }
    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Chi co the huy yeu cau dang cho xu ly.' });
    }

    const { error } = await supabase
      .from('roommate_requests')
      .delete()
      .eq('id', req.params.id);

    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ message: '?? h?y y?u c?u ? gh?p.' });
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
        room:rooms!room_id (id, title, city, address, price, available_slots, host_id, broker_id,
          room_images (image_url, is_primary))
      `)
      .order('created_at', { ascending: false });

    if (roomId) {
      const { data: room } = await supabase
        .from('rooms')
        .select('host_id, broker_id')
        .eq('id', roomId)
        .single();
      if (!room || (room.host_id !== req.user.id && room.broker_id !== req.user.id)) {
        return res.status(403).json({ error: 'B?n kh?ng c? quy?n xem y?u c?u cho ph?ng n?y.' });
      }
      query = query.eq('room_id', roomId);
    } else if (req.user.role === 'tenant') {
      query = query.eq('tenant_id', req.user.id);
    } else if (req.user.role === 'landlord' || req.user.role === 'broker') {
      let myRoomsQuery = supabase
        .from('rooms')
        .select('id');
      if (req.user.role === 'broker') {
        myRoomsQuery = myRoomsQuery.eq('broker_id', req.user.id);
      } else {
        myRoomsQuery = myRoomsQuery.eq('host_id', req.user.id);
      }
      const { data: myRooms } = await myRoomsQuery;
      const roomIds = (myRooms || []).map(r => r.id);
      if (!roomIds.length) return res.status(200).json([]);
      query = query.in('room_id', roomIds);
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
