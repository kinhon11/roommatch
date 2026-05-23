const supabase = require('../config/supabaseClient');
const { logActivity } = require('../utils/activityLogger');

const LEAD_SELECT = `
  *,
  tenant:users!broker_leads_tenant_id_fkey (id, full_name, email, phone, avatar_url),
  assigned_room:rooms!broker_leads_assigned_room_id_fkey (id, title, price, address, city),
  recommended_rooms:broker_lead_rooms (
    id, room_id, match_reason, tenant_feedback, status, created_at,
    room:rooms (id, title, price, address, city, available_slots, is_available, status, room_images (image_url, is_primary))
  ),
  commission:broker_commissions (id, amount, commission_rate, basis_amount, status, note, collected_at, paid_at, created_at, updated_at)
`;

const LEAD_STATUSES = ['new', 'consulted', 'scheduled', 'visited', 'deposit_ready', 'closed', 'lost'];
const RECOMMENDATION_STATUSES = ['suggested', 'interested', 'visited', 'rejected', 'deposit_ready'];
const COMMISSION_RATE_DEFAULT = 0.5;

const normalizeCommissionAmount = (value) => {
  if (value === '' || value === undefined || value === null) return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return amount;
};

const createCommissionForLead = async ({ leadId, brokerId, amount, note }) => {
  const { data: lead, error: leadError } = await supabase
    .from('broker_leads')
    .select(`
      id, broker_id, tenant_id, assigned_room_id,
      assigned_room:rooms!broker_leads_assigned_room_id_fkey (id, price),
      recommended_rooms:broker_lead_rooms (room_id, status, room:rooms (id, price))
    `)
    .eq('id', leadId)
    .eq('broker_id', brokerId)
    .single();

  if (leadError || !lead) return { error: 'Lead khong ton tai.' };

  const preferredRecommendation = (lead.recommended_rooms || []).find(item => item.status === 'deposit_ready')
    || (lead.recommended_rooms || [])[0];
  const roomId = lead.assigned_room_id || preferredRecommendation?.room_id;
  const roomPrice = Number(lead.assigned_room?.price || preferredRecommendation?.room?.price || 0);
  if (!roomId) return { error: 'Can chon phong tu van hoac goi y phong truoc khi tao hoa hong.' };

  const commissionAmount = normalizeCommissionAmount(amount) ?? Math.round(roomPrice * COMMISSION_RATE_DEFAULT);
  if (!Number.isFinite(commissionAmount) || commissionAmount <= 0) {
    return { error: 'So tien hoa hong phai lon hon 0.' };
  }

  const { data, error } = await supabase
    .from('broker_commissions')
    .upsert({
      lead_id: leadId,
      broker_id: brokerId,
      room_id: roomId,
      tenant_id: lead.tenant_id || null,
      amount: commissionAmount,
      commission_rate: amount ? null : COMMISSION_RATE_DEFAULT,
      basis_amount: roomPrice || null,
      status: 'pending_collection',
      note: note?.trim() || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'lead_id' })
    .select('id, amount, commission_rate, basis_amount, status, note, collected_at, paid_at, created_at, updated_at')
    .single();

  if (error) return { error: error.message };
  return { commission: data };
};

const normalizeLeadPayload = (body) => {
  const payload = {
    full_name: body.full_name?.trim(),
    phone: body.phone?.trim(),
    email: body.email?.trim() || null,
    tenant_id: body.tenant_id || null,
    assigned_room_id: body.assigned_room_id || null,
    budget_min: body.budget_min === '' || body.budget_min === undefined ? null : Number(body.budget_min),
    budget_max: body.budget_max === '' || body.budget_max === undefined ? null : Number(body.budget_max),
    preferred_city: body.preferred_city?.trim() || null,
    preferred_area: body.preferred_area?.trim() || null,
    move_in_date: body.move_in_date || null,
    occupants: body.occupants ? Number(body.occupants) : 1,
    has_pets: Boolean(body.has_pets),
    note: body.note?.trim() || null,
    status: body.status || 'new',
    lost_reason: body.lost_reason?.trim() || null,
  };

  if (!payload.full_name || !payload.phone) {
    return { error: 'T?n kh?ch v? s? ?i?n tho?i l? b?t bu?c.' };
  }
  if (!LEAD_STATUSES.includes(payload.status)) {
    return { error: 'Tr?ng th?i lead kh?ng h?p l?.' };
  }
  if (payload.budget_min !== null && (Number.isNaN(payload.budget_min) || payload.budget_min < 0)) {
    return { error: 'Ng?n s?ch t?i thi?u kh?ng h?p l?.' };
  }
  if (payload.budget_max !== null && (Number.isNaN(payload.budget_max) || payload.budget_max < 0)) {
    return { error: 'Ng?n s?ch t?i ?a kh?ng h?p l?.' };
  }
  if (payload.budget_min !== null && payload.budget_max !== null && payload.budget_min > payload.budget_max) {
    return { error: 'Ng?n s?ch t?i thi?u kh?ng ???c l?n h?n t?i ?a.' };
  }
  if (!payload.occupants || Number.isNaN(payload.occupants) || payload.occupants < 1) {
    return { error: 'S? ng??i ? ph?i l?n h?n 0.' };
  }
  if (payload.status !== 'lost') payload.lost_reason = null;

  return { payload };
};

const ensureAssignedRoom = async (roomId, brokerId) => {
  if (!roomId) return null;

  const { data: room, error } = await supabase
    .from('rooms')
    .select('id, broker_id')
    .eq('id', roomId)
    .single();

  if (error || !room) return { error: 'Ph?ng kh?ng t?n t?i.' };
  if (room.broker_id !== brokerId) return { error: 'Broker ch? ???c ch?n ph?ng ?? ???c admin ph?n c?ng.' };
  return null;
};

const listLeads = async (req, res) => {
  try {
    const { status, search } = req.query;
    let query = supabase
      .from('broker_leads')
      .select(LEAD_SELECT)
      .eq('broker_id', req.user.id)
      .order('updated_at', { ascending: false });

    if (status && LEAD_STATUSES.includes(status)) query = query.eq('status', status);
    if (search?.trim()) {
      const term = search.trim();
      query = query.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%,preferred_area.ilike.%${term}%`);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data || []);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const createLead = async (req, res) => {
  try {
    const normalized = normalizeLeadPayload(req.body);
    if (normalized.error) return res.status(400).json({ error: normalized.error });

    const roomError = await ensureAssignedRoom(normalized.payload.assigned_room_id, req.user.id);
    if (roomError) return res.status(400).json({ error: roomError.error });

    const { data, error } = await supabase
      .from('broker_leads')
      .insert({ ...normalized.payload, broker_id: req.user.id })
      .select(LEAD_SELECT)
      .single();

    if (error) return res.status(400).json({ error: error.message });
    await logActivity({
      actorId: req.user.id,
      action: 'broker_lead_created',
      targetType: 'broker_lead',
      targetId: data.id,
      newValue: { status: data.status, phone: data.phone },
    });
    return res.status(201).json({ message: '?? t?o lead kh?ch thu?.', lead: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const updateLead = async (req, res) => {
  try {
    const normalized = normalizeLeadPayload(req.body);
    if (normalized.error) return res.status(400).json({ error: normalized.error });

    const roomError = await ensureAssignedRoom(normalized.payload.assigned_room_id, req.user.id);
    if (roomError) return res.status(400).json({ error: roomError.error });

    const { data: existing } = await supabase
      .from('broker_leads')
      .select('id, status, broker_id')
      .eq('id', req.params.id)
      .eq('broker_id', req.user.id)
      .single();

    if (!existing) return res.status(404).json({ error: 'Lead kh?ng t?n t?i.' });

    const { data, error } = await supabase
      .from('broker_leads')
      .update({ ...normalized.payload, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('broker_id', req.user.id)
      .select(LEAD_SELECT)
      .single();

    if (error) return res.status(400).json({ error: error.message });

    let commission = null;
    if (existing.status !== data.status && data.status === 'closed') {
      const commissionResult = await createCommissionForLead({
        leadId: req.params.id,
        brokerId: req.user.id,
        amount: req.body.commission_amount,
        note: req.body.commission_note,
      });
      if (commissionResult.error) return res.status(400).json({ error: commissionResult.error });
      commission = commissionResult.commission;
    }

    if (existing.status !== data.status) {
      await logActivity({
        actorId: req.user.id,
        action: data.status === 'closed' ? 'broker_commission_created' : 'broker_lead_status_updated',
        targetType: 'broker_lead',
        targetId: data.id,
        oldValue: { status: existing.status },
        newValue: { status: data.status, commission_id: commission?.id || null },
      });
    }
    return res.status(200).json({ message: 'Da cap nhat lead.', lead: { ...data, commission } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const updateLeadStatus = async (req, res) => {
  try {
    const { status, lost_reason, commission_amount, commission_note } = req.body;
    if (!LEAD_STATUSES.includes(status)) return res.status(400).json({ error: 'Trang thai lead khong hop le.' });
    if (status === 'lost' && !lost_reason?.trim()) {
      return res.status(400).json({ error: 'C?n nh?p l? do th?t b?i.' });
    }

    const { data: existing } = await supabase
      .from('broker_leads')
      .select('id, status')
      .eq('id', req.params.id)
      .eq('broker_id', req.user.id)
      .single();

    if (!existing) return res.status(404).json({ error: 'Lead kh?ng t?n t?i.' });

    const { data, error } = await supabase
      .from('broker_leads')
      .update({
        status,
        lost_reason: status === 'lost' ? lost_reason.trim() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .eq('broker_id', req.user.id)
      .select(LEAD_SELECT)
      .single();

    if (error) return res.status(400).json({ error: error.message });

    let commission = null;
    if (status === 'closed') {
      const commissionResult = await createCommissionForLead({
        leadId: req.params.id,
        brokerId: req.user.id,
        amount: commission_amount,
        note: commission_note,
      });
      if (commissionResult.error) return res.status(400).json({ error: commissionResult.error });
      commission = commissionResult.commission;
    }

    await logActivity({
      actorId: req.user.id,
      action: status === 'closed' ? 'broker_commission_created' : 'broker_lead_status_updated',
      targetType: 'broker_lead',
      targetId: req.params.id,
      oldValue: { status: existing.status },
      newValue: { status, commission_id: commission?.id || null },
    });
    return res.status(200).json({ message: 'Da cap nhat trang thai lead.', lead: { ...data, commission } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const deleteLead = async (req, res) => {
  try {
    const { error, count } = await supabase
      .from('broker_leads')
      .delete({ count: 'exact' })
      .eq('id', req.params.id)
      .eq('broker_id', req.user.id);

    if (error) return res.status(400).json({ error: error.message });
    if (!count) return res.status(404).json({ error: 'Lead kh?ng t?n t?i.' });
    return res.status(200).json({ message: 'Da xoa lead.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const recommendRoom = async (req, res) => {
  try {
    const { room_id, match_reason, tenant_feedback, status = 'suggested' } = req.body;
    if (!room_id) return res.status(400).json({ error: 'room_id l? b?t bu?c.' });
    if (!RECOMMENDATION_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Tr?ng th?i ph?ng g?i ? kh?ng h?p l?.' });
    }

    const { data: lead } = await supabase
      .from('broker_leads')
      .select('id')
      .eq('id', req.params.id)
      .eq('broker_id', req.user.id)
      .single();

    if (!lead) return res.status(404).json({ error: 'Lead kh?ng t?n t?i.' });

    const roomError = await ensureAssignedRoom(room_id, req.user.id);
    if (roomError) return res.status(400).json({ error: roomError.error });

    const { data, error } = await supabase
      .from('broker_lead_rooms')
      .upsert({
        lead_id: req.params.id,
        room_id,
        broker_id: req.user.id,
        match_reason: match_reason?.trim() || null,
        tenant_feedback: tenant_feedback?.trim() || null,
        status,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'lead_id,room_id' })
      .select(`
        *,
        room:rooms (id, title, price, address, city, available_slots, is_available, status, room_images (image_url, is_primary))
      `)
      .single();

    if (error) return res.status(400).json({ error: error.message });
    await logActivity({
      actorId: req.user.id,
      action: 'broker_room_recommended',
      targetType: 'broker_lead',
      targetId: req.params.id,
      newValue: { room_id, status },
    });
    return res.status(200).json({ message: '?? g?i ? ph?ng cho lead.', recommendation: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const updateRecommendation = async (req, res) => {
  try {
    const { status, match_reason, tenant_feedback } = req.body;
    if (status && !RECOMMENDATION_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Tr?ng th?i ph?ng g?i ? kh?ng h?p l?.' });
    }

    const { data, error } = await supabase
      .from('broker_lead_rooms')
      .update({
        status,
        match_reason: match_reason?.trim() || null,
        tenant_feedback: tenant_feedback?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.recommendationId)
      .eq('lead_id', req.params.id)
      .eq('broker_id', req.user.id)
      .select(`
        *,
        room:rooms (id, title, price, address, city, available_slots, is_available, status, room_images (image_url, is_primary))
      `)
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ message: '?? c?p nh?t ph?ng g?i ?.', recommendation: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const deleteRecommendation = async (req, res) => {
  try {
    const { error, count } = await supabase
      .from('broker_lead_rooms')
      .delete({ count: 'exact' })
      .eq('id', req.params.recommendationId)
      .eq('lead_id', req.params.id)
      .eq('broker_id', req.user.id);

    if (error) return res.status(400).json({ error: error.message });
    if (!count) return res.status(404).json({ error: 'Ph?ng g?i ? kh?ng t?n t?i.' });
    return res.status(200).json({ message: '?? x?a ph?ng g?i ?.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const listCommissions = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('broker_commissions')
      .select(`
        *,
        lead:broker_leads (id, full_name, phone, status),
        room:rooms (id, title, price, address, city),
        tenant:users!broker_commissions_tenant_id_fkey (id, full_name, email, phone)
      `)
      .eq('broker_id', req.user.id)
      .order('updated_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data || []);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const listAssignedRooms = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('rooms')
      .select('id, title, price, address, city, available_slots, is_available, status, room_images (image_url, is_primary)')
      .eq('broker_id', req.user.id)
      .order('updated_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data || []);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  listLeads,
  createLead,
  updateLead,
  updateLeadStatus,
  deleteLead,
  recommendRoom,
  updateRecommendation,
  deleteRecommendation,
  listCommissions,
  listAssignedRooms,
};
