const supabase = require('../config/supabaseClient');

const ACTIVE_DEPOSIT_STATUSES = ['pending_payment', 'paid'];
const DEPOSIT_STATUSES = ['pending_payment', 'paid', 'cancelled', 'refunded'];

const createNotification = async (userId, type, payload) => {
  try {
    await supabase.from('notifications').insert({ user_id: userId, type, payload });
  } catch (e) {
    console.warn('Failed to create deposit notification:', e.message);
  }
};

const hasDepositEligibility = async ({ roomId, tenantId }) => {
  const { data: acceptedRequest, error: requestError } = await supabase
    .from('roommate_requests')
    .select('id')
    .eq('room_id', roomId)
    .eq('tenant_id', tenantId)
    .eq('status', 'accepted')
    .maybeSingle();
  if (requestError) throw requestError;
  if (acceptedRequest) return { eligible: true, roommate_request_id: acceptedRequest.id };

  const { data: appointment, error: appointmentError } = await supabase
    .from('appointments')
    .select('id')
    .eq('room_id', roomId)
    .eq('tenant_id', tenantId)
    .in('status', ['confirmed', 'completed'])
    .order('scheduled_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (appointmentError) throw appointmentError;
  if (appointment) return { eligible: true, appointment_id: appointment.id };

  return { eligible: false };
};

const insertTransaction = async ({ depositId, actorId, fromStatus, toStatus, amount, note }) => {
  await supabase.from('deposit_transactions').insert({
    deposit_id: depositId,
    actor_id: actorId,
    from_status: fromStatus || null,
    to_status: toStatus,
    amount,
    note: note?.trim() || null,
  });
};

const getDeposits = async (req, res) => {
  try {
    let query = supabase
      .from('room_deposits')
      .select(`
        *,
        room:rooms (id, title, address, city, price, is_hidden, is_available, status),
        tenant:users!tenant_id (id, full_name, email, phone, avatar_url),
        landlord:users!landlord_id (id, full_name, email, phone, avatar_url),
        transactions:deposit_transactions (*)
      `)
      .order('created_at', { ascending: false })
      .order('created_at', { referencedTable: 'deposit_transactions', ascending: false });

    if (req.user.role === 'tenant') {
      query = query.eq('tenant_id', req.user.id);
    } else if (req.user.role === 'landlord') {
      query = query.eq('landlord_id', req.user.id);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data || []);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const createDeposit = async (req, res) => {
  try {
    const { room_id, amount, note } = req.body;
    const depositAmount = Number(amount);

    if (!room_id) return res.status(400).json({ error: 'room_id is required.' });
    if (!Number.isFinite(depositAmount) || depositAmount <= 0) {
      return res.status(400).json({ error: 'So tien coc phai lon hon 0.' });
    }

    const { data: room } = await supabase
      .from('rooms')
      .select('id, host_id, title, status, is_hidden, is_available')
      .eq('id', room_id)
      .single();

    if (!room) return res.status(404).json({ error: 'Ph?ng kh?ng t?n t?i.' });
    if (room.host_id === req.user.id) {
      return res.status(400).json({ error: 'B?n kh?ng th? c?c ph?ng c?a ch?nh m?nh.' });
    }
    if (room.status !== 'approved' || room.is_hidden === true || room.is_available === false) {
      return res.status(400).json({ error: 'Ph?ng n?y hi?n kh?ng nh?n c?c.' });
    }

    const eligibility = await hasDepositEligibility({ roomId: room_id, tenantId: req.user.id });
    if (!eligibility.eligible) {
      return res.status(400).json({
        error: 'Chi tenant co request accepted hoac lich hen confirmed/completed moi duoc gui yeu cau coc.',
      });
    }

    const { data: existing, error: existingError } = await supabase
      .from('room_deposits')
      .select('id, status')
      .eq('room_id', room_id)
      .in('status', ACTIVE_DEPOSIT_STATUSES)
      .maybeSingle();
    if (existingError) return res.status(400).json({ error: existingError.message });
    if (existing) {
      return res.status(409).json({ error: 'Ph?ng nay dang co yeu cau coc hoac da duoc giu.' });
    }

    const { data, error } = await supabase
      .from('room_deposits')
      .insert({
        room_id,
        tenant_id: req.user.id,
        landlord_id: room.host_id,
        roommate_request_id: eligibility.roommate_request_id || null,
        appointment_id: eligibility.appointment_id || null,
        amount: depositAmount,
        status: 'pending_payment',
        payment_method: 'manual',
        note: note?.trim() || null,
      })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    await insertTransaction({
      depositId: data.id,
      actorId: req.user.id,
      toStatus: 'pending_payment',
      amount: depositAmount,
      note: note || 'Tenant gui yeu cau dat coc.',
    });

    await createNotification(room.host_id, 'deposit', {
      message: `${req.user.full_name || req.user.email} g?i y?u c?u c?c ph?ng "${room.title}".`,
      deposit_id: data.id,
      room_id,
    });

    return res.status(201).json({ message: 'Da gui yeu cau dat coc.', deposit: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const updateDepositStatus = async (req, res) => {
  try {
    const { status, note } = req.body;
    if (!DEPOSIT_STATUSES.includes(status) || status === 'pending_payment') {
      return res.status(400).json({ error: 'Tr?ng th?i c?c kh?ng h?p l?.' });
    }

    const { data: deposit } = await supabase
      .from('room_deposits')
      .select('*, room:rooms (id, title)')
      .eq('id', req.params.id)
      .single();

    if (!deposit) return res.status(404).json({ error: 'Y?u c?u c?c kh?ng t?n t?i.' });

    const isTenant = deposit.tenant_id === req.user.id;
    const isLandlord = deposit.landlord_id === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isTenant && !isLandlord && !isAdmin) {
      return res.status(403).json({ error: 'B?n kh?ng c? quy?n c?p nh?t y?u c?u c?c n?y.' });
    }

    if (isTenant && !isAdmin && status !== 'cancelled') {
      return res.status(403).json({ error: 'Tenant ch? c? th? h?y y?u c?u c?c ?ang ch? thanh to?n.' });
    }
    if (status === 'cancelled' && deposit.status !== 'pending_payment') {
      return res.status(400).json({ error: 'Ch? c? th? h?y y?u c?u c?c ?ang ch? thanh to?n.' });
    }
    if (status === 'paid' && deposit.status !== 'pending_payment') {
      return res.status(400).json({ error: 'Ch? c? th? x?c nh?n thanh to?n t? pending_payment.' });
    }
    if (status === 'refunded' && deposit.status !== 'paid') {
      return res.status(400).json({ error: 'Ch? c? th? ho?n c?c sau khi ?? thanh to?n.' });
    }
    if (['cancelled', 'refunded'].includes(status) && !note?.trim()) {
      return res.status(400).json({ error: 'L? do h?y/ho?n c?c l? b?t bu?c.' });
    }

    const timestamp = new Date().toISOString();
    const updateData = { status };
    if (status === 'paid') {
      updateData.paid_at = timestamp;
      updateData.landlord_note = note?.trim() || null;
    }
    if (status === 'cancelled') {
      updateData.cancelled_at = timestamp;
      updateData.cancel_reason = note.trim();
    }
    if (status === 'refunded') {
      updateData.refunded_at = timestamp;
      updateData.refund_reason = note.trim();
    }

    const { data, error } = await supabase
      .from('room_deposits')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });

    await insertTransaction({
      depositId: deposit.id,
      actorId: req.user.id,
      fromStatus: deposit.status,
      toStatus: status,
      amount: deposit.amount,
      note,
    });

    if (status === 'paid') {
      await supabase
        .from('rooms')
        .update({
          is_hidden: true,
          is_available: false,
          auto_hidden_reason: `?? gi? ph?ng b?ng c?c ${deposit.id}`,
          hidden_at: timestamp,
        })
        .eq('id', deposit.room_id);
    }

    const notifyUserId = isLandlord || isAdmin ? deposit.tenant_id : deposit.landlord_id;
    await createNotification(notifyUserId, 'deposit', {
      message: `Y?u c?u c?c ph?ng "${deposit.room?.title || 'Ph?ng'}" da cap nhat sang ${status}.`,
      deposit_id: deposit.id,
      room_id: deposit.room_id,
    });

    return res.status(200).json({ message: 'Da cap nhat yeu cau coc.', deposit: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { getDeposits, createDeposit, updateDepositStatus };
