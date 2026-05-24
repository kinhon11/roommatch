const supabase = require('../config/supabaseClient');
const {
  syncBrokerLeadFromTenantAction,
  createBrokerCommissionFromDeposit,
  BROKER_COMMISSION_RATE_DEFAULT,
} = require('../utils/brokerLeadSync');

const ACTIVE_DEPOSIT_STATUSES = ['pending_payment', 'admin_confirmed', 'landlord_accepted', 'paid'];
const DEPOSIT_STATUSES = [
  'pending_payment',
  'admin_confirmed',
  'landlord_accepted',
  'refund_pending',
  'paid',
  'cancelled',
  'refunded',
];
const COMPANY_COMMISSION_RATE = 0.35;
const BROKER_COMMISSION_RATE = BROKER_COMMISSION_RATE_DEFAULT;
const DEPOSIT_SCOPES = {
  FULL_ROOM: 'full_room',
  SLOT: 'slot',
};

const createNotification = async (userId, type, payload) => {
  try {
    await supabase.from('notifications').insert({ user_id: userId, type, payload });
  } catch (e) {
    console.warn('Failed to create deposit notification:', e.message);
  }
};

const hasDepositEligibility = async ({ roomId, tenantId, requestedScope }) => {
  const { data: acceptedRequest, error: requestError } = await supabase
    .from('roommate_requests')
    .select('id, occupants')
    .eq('room_id', roomId)
    .eq('tenant_id', tenantId)
    .eq('status', 'accepted')
    .maybeSingle();
  if (requestError) throw requestError;

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

  const selectedScope = requestedScope || (acceptedRequest ? DEPOSIT_SCOPES.SLOT : DEPOSIT_SCOPES.FULL_ROOM);

  if (selectedScope === DEPOSIT_SCOPES.SLOT) {
    if (!acceptedRequest) return { eligible: false, reason: 'slot_requires_accepted_request' };
    return {
      eligible: true,
      roommate_request_id: acceptedRequest.id,
      deposit_scope: DEPOSIT_SCOPES.SLOT,
      deposit_slots: Math.max(Number(acceptedRequest.occupants) || 1, 1),
      slots_already_reserved: true,
    };
  }

  if (selectedScope === DEPOSIT_SCOPES.FULL_ROOM) {
    if (!appointment) return { eligible: false, reason: 'full_room_requires_appointment' };
    return {
      eligible: true,
      appointment_id: appointment.id,
      deposit_scope: DEPOSIT_SCOPES.FULL_ROOM,
      deposit_slots: 1,
      slots_already_reserved: false,
    };
  }

  return { eligible: false };
};

const notifyAdmins = async (type, payload) => {
  const { data: admins, error } = await supabase
    .from('users')
    .select('id, is_locked')
    .eq('role', 'admin');

  if (error) {
    console.warn('Failed to find admins for deposit notification:', error.message);
    return;
  }

  await Promise.all((admins || [])
    .filter(admin => admin.is_locked !== true)
    .map(admin => createNotification(admin.id, type, payload)));
};

const calculateRateAmount = (amount, rate) => {
  const numericAmount = Number(amount || 0);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) return 0;
  return Math.round(numericAmount * rate);
};

const getBrokerCommissionAmount = (deposit) => {
  if (!deposit?.room?.broker_id) return 0;
  const amount = Number(deposit.amount || 0);
  return calculateRateAmount(amount, BROKER_COMMISSION_RATE);
};

const attachDepositMoneySummary = (deposit) => {
  const brokerCommissionAmount = getBrokerCommissionAmount(deposit);
  const companyCommissionAmount = calculateRateAmount(deposit.amount, COMPANY_COMMISSION_RATE);
  const amount = Number(deposit.amount || 0);
  return {
    ...deposit,
    company_commission_rate: COMPANY_COMMISSION_RATE,
    company_commission_amount: companyCommissionAmount,
    broker_commission_rate: deposit?.room?.broker_id ? BROKER_COMMISSION_RATE : 0,
    broker_commission_amount: brokerCommissionAmount,
    landlord_receive_amount: Math.max(amount - companyCommissionAmount - brokerCommissionAmount, 0),
  };
};

const getActiveDepositsForRoom = async (roomId) => {
  const { data, error } = await supabase
    .from('room_deposits')
    .select('id, tenant_id, status, deposit_scope, deposit_slots')
    .eq('room_id', roomId)
    .in('status', ACTIVE_DEPOSIT_STATUSES);

  if (error) throw error;
  return data || [];
};

const calculateDepositAmount = ({ room, scope, slots }) => {
  const baseAmount = Number(room?.deposit_amount || room?.price || 0);
  if (!Number.isFinite(baseAmount) || baseAmount <= 0) return null;
  if (scope === DEPOSIT_SCOPES.SLOT) {
    const maxOccupants = Math.max(Number(room?.max_occupants) || Number(room?.available_slots) || 1, 1);
    return Math.ceil((baseAmount / maxOccupants) * Math.max(Number(slots) || 1, 1));
  }
  return baseAmount;
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

const cancelBrokerCommissionForDeposit = async ({ brokerId, tenantId, roomId, note }) => {
  if (!brokerId || !tenantId || !roomId) return;
  const { error } = await supabase
    .from('broker_commissions')
    .update({
      status: 'cancelled',
      note: note?.trim() || 'Huy hoa hong do yeu cau coc khong thanh cong.',
      updated_at: new Date().toISOString(),
    })
    .eq('broker_id', brokerId)
    .eq('tenant_id', tenantId)
    .eq('room_id', roomId)
    .neq('status', 'paid_to_broker');

  if (error) console.warn('Failed to cancel broker commission:', error.message);
};

const getDeposits = async (req, res) => {
  try {
    let brokerRoomIds = [];
    if (req.user.role === 'broker') {
      const { data: assignedRooms, error: roomError } = await supabase
        .from('rooms')
        .select('id')
        .eq('broker_id', req.user.id);
      if (roomError) return res.status(500).json({ error: roomError.message });
      brokerRoomIds = (assignedRooms || []).map(room => room.id);
      if (!brokerRoomIds.length) return res.status(200).json([]);
    }

    let query = supabase
      .from('room_deposits')
      .select(`
        *,
        room:rooms (id, title, address, city, price, is_hidden, is_available, available_slots, status, broker_id),
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
    } else if (req.user.role === 'broker') {
      query = query.in('room_id', brokerRoomIds);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json((data || []).map(attachDepositMoneySummary));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const createDeposit = async (req, res) => {
  try {
    const { room_id, amount, note, deposit_scope } = req.body;
    const requestedAmount = Number(amount);
    const requestedScope = deposit_scope || null;

    if (!room_id) return res.status(400).json({ error: 'room_id is required.' });
    if (amount !== undefined && amount !== null && amount !== '' && (!Number.isFinite(requestedAmount) || requestedAmount <= 0)) {
      return res.status(400).json({ error: 'So tien coc phai lon hon 0.' });
    }
    if (requestedScope && !Object.values(DEPOSIT_SCOPES).includes(requestedScope)) {
      return res.status(400).json({ error: 'Loai coc khong hop le.' });
    }

    const { data: room } = await supabase
      .from('rooms')
      .select('id, host_id, broker_id, title, price, deposit_amount, max_occupants, status, is_hidden, is_available, available_slots')
      .eq('id', room_id)
      .single();

    if (!room) return res.status(404).json({ error: 'Phong khong ton tai.' });
    if (room.host_id === req.user.id || room.broker_id === req.user.id) {
      return res.status(400).json({ error: 'Ban khong the coc phong cua chinh minh.' });
    }

    const eligibility = await hasDepositEligibility({ roomId: room_id, tenantId: req.user.id, requestedScope });
    if (!eligibility.eligible) {
      if (eligibility.reason === 'slot_requires_accepted_request') {
        return res.status(400).json({ error: 'Chi co the coc slot khi yeu cau o ghep da duoc chu nha chap nhan.' });
      }
      if (eligibility.reason === 'full_room_requires_appointment') {
        return res.status(400).json({ error: 'Coc nguyen can can co lich hen da xac nhan hoac hoan thanh.' });
      }
      return res.status(400).json({
        error: 'Chi tenant co request accepted hoac lich hen confirmed/completed moi duoc gui yeu cau coc.',
      });
    }
    if (
      room.status !== 'approved'
      || room.is_hidden === true
      || (room.is_available === false && !eligibility.roommate_request_id)
    ) {
      return res.status(400).json({ error: 'Phong nay hien khong nhan coc.' });
    }

    const activeDeposits = await getActiveDepositsForRoom(room_id);
    const hasActiveFullRoomDeposit = activeDeposits.some(item =>
      (item.deposit_scope || DEPOSIT_SCOPES.FULL_ROOM) === DEPOSIT_SCOPES.FULL_ROOM
    );
    const hasTenantActiveDeposit = activeDeposits.some(item => item.tenant_id === req.user.id);
    const depositScope = eligibility.deposit_scope || DEPOSIT_SCOPES.FULL_ROOM;
    const depositSlots = Math.max(Number(eligibility.deposit_slots) || 1, 1);
    const depositAmount = calculateDepositAmount({ room, scope: depositScope, slots: depositSlots });
    if (!depositAmount) {
      return res.status(400).json({ error: 'Phong nay chua co du lieu tien coc hop le.' });
    }

    if (hasTenantActiveDeposit) {
      return res.status(409).json({ error: 'Ban da co yeu cau coc dang xu ly cho phong nay.' });
    }
    if (hasActiveFullRoomDeposit) {
      return res.status(409).json({ error: 'Phong nay dang co yeu cau coc nguyen can hoac da duoc giu.' });
    }
    if (depositScope === DEPOSIT_SCOPES.FULL_ROOM && activeDeposits.length > 0) {
      return res.status(409).json({ error: 'Phong nay dang co khach coc/giu slot o ghep.' });
    }
    if (depositScope === DEPOSIT_SCOPES.SLOT && !eligibility.slots_already_reserved) {
      const activeSlotCount = activeDeposits
        .filter(item => (item.deposit_scope || DEPOSIT_SCOPES.FULL_ROOM) === DEPOSIT_SCOPES.SLOT)
        .reduce((sum, item) => sum + Math.max(Number(item.deposit_slots) || 1, 1), 0);
      const availableSlots = Number(room.available_slots) || 0;
      if (availableSlots - activeSlotCount < depositSlots) {
        return res.status(409).json({ error: 'Phong khong con du slot de dat coc.' });
      }
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
        deposit_scope: depositScope,
        deposit_slots: depositSlots,
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

    await notifyAdmins('deposit', {
      message: `${req.user.full_name || req.user.email} gui yeu cau coc phong "${room.title}", cho admin xac nhan tien.`,
      deposit_id: data.id,
      room_id,
    });

    if (room.broker_id) {
      await createNotification(room.broker_id, 'deposit', {
        message: `${req.user.full_name || req.user.email} muon coc phong "${room.title}".`,
        deposit_id: data.id,
        room_id,
      });
      await syncBrokerLeadFromTenantAction({
        brokerId: room.broker_id,
        tenantId: req.user.id,
        roomId: room_id,
        status: 'deposit_ready',
        note: `Khach da gui yeu cau coc phong "${room.title}", cho admin xac nhan tien.`,
      });
    }

    return res.status(201).json({ message: 'Da gui yeu cau dat coc.', deposit: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const updateDepositStatus = async (req, res) => {
  try {
    const { status, note } = req.body;
    if (!DEPOSIT_STATUSES.includes(status) || status === 'pending_payment') {
      return res.status(400).json({ error: 'Trang thai coc khong hop le.' });
    }

    const { data: deposit } = await supabase
      .from('room_deposits')
      .select('*, room:rooms (id, title, broker_id, status, available_slots, last_available_slots, is_hidden, is_available, auto_hidden_reason)')
      .eq('id', req.params.id)
      .single();

    if (!deposit) return res.status(404).json({ error: 'Yeu cau coc khong ton tai.' });

    const isTenant = deposit.tenant_id === req.user.id;
    const isLandlord = deposit.landlord_id === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isTenant && !isLandlord && !isAdmin) {
      return res.status(403).json({ error: 'Ban khong co quyen cap nhat yeu cau coc nay.' });
    }

    const validTransition =
      (status === 'cancelled' && isTenant && deposit.status === 'pending_payment')
      || (status === 'admin_confirmed' && isAdmin && deposit.status === 'pending_payment')
      || (status === 'landlord_accepted' && isLandlord && deposit.status === 'admin_confirmed')
      || (status === 'refund_pending' && isLandlord && deposit.status === 'admin_confirmed')
      || (status === 'refunded' && isAdmin && ['refund_pending', 'landlord_accepted', 'paid'].includes(deposit.status))
      || (status === 'paid' && isAdmin && deposit.status === 'landlord_accepted');

    if (!validTransition) {
      return res.status(403).json({ error: 'Trang thai nay khong dung vai tro hoac khong dung buoc xu ly.' });
    }
    if (['cancelled', 'refund_pending', 'refunded'].includes(status) && !note?.trim()) {
      return res.status(400).json({ error: 'Ly do la bat buoc.' });
    }

    const timestamp = new Date().toISOString();
    const updateData = { status };
    if (status === 'admin_confirmed' || status === 'paid') {
      updateData.paid_at = timestamp;
      updateData.landlord_note = note?.trim() || null;
    }
    if (status === 'landlord_accepted') {
      updateData.landlord_note = note?.trim() || 'Chu nha dong y nhan coc.';
    }
    if (status === 'cancelled') {
      updateData.cancelled_at = timestamp;
      updateData.cancel_reason = note.trim();
    }
    if (status === 'refund_pending') {
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

    if (status === 'landlord_accepted' || status === 'paid') {
      const depositScope = deposit.deposit_scope || DEPOSIT_SCOPES.FULL_ROOM;
      const depositSlots = Math.max(Number(deposit.deposit_slots) || 1, 1);
      const currentSlots = Number(deposit.room?.available_slots) || 0;

      await supabase
        .from('rooms')
        .update(depositScope === DEPOSIT_SCOPES.FULL_ROOM
          ? {
              is_hidden: true,
              is_available: false,
              available_slots: 0,
              last_available_slots: currentSlots > 0 ? currentSlots : deposit.room?.last_available_slots,
              auto_hidden_reason: `deposit_full_room:${deposit.id}`,
              hidden_at: timestamp,
            }
          : (() => {
              const remainingSlots = deposit.roommate_request_id
                ? currentSlots
                : Math.max(currentSlots - depositSlots, 0);
              return {
                is_hidden: remainingSlots <= 0,
                is_available: remainingSlots > 0,
                available_slots: remainingSlots,
                last_available_slots: remainingSlots > 0 ? remainingSlots : (currentSlots > 0 ? currentSlots : deposit.room?.last_available_slots),
                auto_hidden_reason: remainingSlots <= 0 ? `deposit_slots_full:${deposit.id}` : null,
                hidden_at: remainingSlots <= 0 ? timestamp : null,
              };
            })())
        .eq('id', deposit.room_id);

      if (deposit.room?.broker_id) {
        const syncedLead = await syncBrokerLeadFromTenantAction({
          brokerId: deposit.room.broker_id,
          tenantId: deposit.tenant_id,
          roomId: deposit.room_id,
          status: 'closed',
          note: `Chu nha da dong y nhan coc phong "${deposit.room?.title || 'Phong'}".`,
        });

        if (syncedLead.lead?.id) {
          await createBrokerCommissionFromDeposit({
            brokerId: deposit.room.broker_id,
            tenantId: deposit.tenant_id,
            roomId: deposit.room_id,
            leadId: syncedLead.lead.id,
            amount: deposit.amount,
            note: `Tu dong tao khi admin da nhan coc va chu nha dong y phong "${deposit.room?.title || 'Phong'}".`,
          });
        }
      }
    }

    if (status === 'refunded' && ['landlord_accepted', 'paid'].includes(deposit.status)) {
      const depositScope = deposit.deposit_scope || DEPOSIT_SCOPES.FULL_ROOM;
      const depositSlots = Math.max(Number(deposit.deposit_slots) || 1, 1);
      const currentSlots = Number(deposit.room?.available_slots) || 0;

      if (depositScope === DEPOSIT_SCOPES.FULL_ROOM && deposit.room?.auto_hidden_reason === `deposit_full_room:${deposit.id}`) {
        const restoredSlots = Math.max(Number(deposit.room?.last_available_slots) || 1, 1);
        await supabase
          .from('rooms')
          .update({
            is_hidden: false,
            is_available: true,
            available_slots: restoredSlots,
            auto_hidden_reason: null,
            hidden_at: null,
          })
          .eq('id', deposit.room_id);
      } else if (depositScope === DEPOSIT_SCOPES.SLOT && !deposit.roommate_request_id) {
        const restoredSlots = currentSlots + depositSlots;
        await supabase
          .from('rooms')
          .update({
            is_hidden: false,
            is_available: restoredSlots > 0,
            available_slots: restoredSlots,
            last_available_slots: restoredSlots,
            auto_hidden_reason: null,
            hidden_at: null,
          })
          .eq('id', deposit.room_id);
      }
    }

    if (['cancelled', 'refund_pending', 'refunded'].includes(status) && deposit.room?.broker_id) {
      await cancelBrokerCommissionForDeposit({
        brokerId: deposit.room.broker_id,
        tenantId: deposit.tenant_id,
        roomId: deposit.room_id,
        note: status === 'refunded'
          ? `Huy hoa hong do da hoan coc: ${note}`
          : `Huy hoa hong do yeu cau coc khong thanh cong: ${note}`,
      });
    }

    if (status === 'admin_confirmed') {
      await createNotification(deposit.landlord_id, 'deposit', {
        message: `Admin da xac nhan nhan ${deposit.amount} tien coc phong "${deposit.room?.title || 'Phong'}". Vui long dong y hoac khong dong y nhan coc.`,
        deposit_id: deposit.id,
        room_id: deposit.room_id,
      });
      await createNotification(deposit.tenant_id, 'deposit', {
        message: `Admin da xac nhan tien coc phong "${deposit.room?.title || 'Phong'}", dang cho chu nha quyet dinh.`,
        deposit_id: deposit.id,
        room_id: deposit.room_id,
      });
    } else if (status === 'refund_pending') {
      await notifyAdmins('deposit', {
        message: `Chu nha khong dong y nhan coc phong "${deposit.room?.title || 'Phong'}". Can hoan coc cho khach. Ly do: ${note}`,
        deposit_id: deposit.id,
        room_id: deposit.room_id,
      });
      await createNotification(deposit.tenant_id, 'deposit', {
        message: `Chu nha khong dong y nhan coc phong "${deposit.room?.title || 'Phong'}". Admin se xu ly hoan coc.`,
        deposit_id: deposit.id,
        room_id: deposit.room_id,
      });
    } else {
      const notifyUserId = isLandlord || isAdmin ? deposit.tenant_id : deposit.landlord_id;
      await createNotification(notifyUserId, 'deposit', {
        message: `Yeu cau coc phong "${deposit.room?.title || 'Phong'}" da cap nhat sang ${status}.`,
        deposit_id: deposit.id,
        room_id: deposit.room_id,
      });
    }

    return res.status(200).json({ message: 'Da cap nhat yeu cau coc.', deposit: attachDepositMoneySummary({ ...data, room: deposit.room }) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { getDeposits, createDeposit, updateDepositStatus };
