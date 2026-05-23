const supabase = require('../config/supabaseClient');
const { logActivity } = require('../utils/activityLogger');

const LEAD_SELECT = `
  *,
  tenant:users!broker_leads_tenant_id_fkey (id, full_name, email, phone, avatar_url),
  assigned_room:rooms!broker_leads_assigned_room_id_fkey (id, title, price, address, city),
  recommended_rooms:broker_lead_rooms (
    id, room_id, match_reason, tenant_feedback, status, created_at,
    room:rooms (id, title, price, address, city, available_slots, is_available, status, room_images (image_url, is_primary))
  )
`;

const LEAD_STATUSES = ['new', 'consulted', 'scheduled', 'visited', 'deposit_ready', 'closed', 'lost'];
const RECOMMENDATION_STATUSES = ['suggested', 'interested', 'visited', 'rejected', 'deposit_ready'];

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
    return { error: 'Ten khach va so dien thoai la bat buoc.' };
  }
  if (!LEAD_STATUSES.includes(payload.status)) {
    return { error: 'Trang thai lead khong hop le.' };
  }
  if (payload.budget_min !== null && (Number.isNaN(payload.budget_min) || payload.budget_min < 0)) {
    return { error: 'Ngan sach toi thieu khong hop le.' };
  }
  if (payload.budget_max !== null && (Number.isNaN(payload.budget_max) || payload.budget_max < 0)) {
    return { error: 'Ngan sach toi da khong hop le.' };
  }
  if (payload.budget_min !== null && payload.budget_max !== null && payload.budget_min > payload.budget_max) {
    return { error: 'Ngan sach toi thieu khong duoc lon hon toi da.' };
  }
  if (!payload.occupants || Number.isNaN(payload.occupants) || payload.occupants < 1) {
    return { error: 'So nguoi o phai lon hon 0.' };
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

  if (error || !room) return { error: 'Phong khong ton tai.' };
  if (room.broker_id !== brokerId) return { error: 'Broker chi duoc chon phong da duoc admin phan cong.' };
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
    return res.status(201).json({ message: 'Da tao lead khach thue.', lead: data });
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

    if (!existing) return res.status(404).json({ error: 'Lead khong ton tai.' });

    const { data, error } = await supabase
      .from('broker_leads')
      .update({ ...normalized.payload, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('broker_id', req.user.id)
      .select(LEAD_SELECT)
      .single();

    if (error) return res.status(400).json({ error: error.message });
    if (existing.status !== data.status) {
      await logActivity({
        actorId: req.user.id,
        action: 'broker_lead_status_updated',
        targetType: 'broker_lead',
        targetId: data.id,
        oldValue: { status: existing.status },
        newValue: { status: data.status },
      });
    }
    return res.status(200).json({ message: 'Da cap nhat lead.', lead: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const updateLeadStatus = async (req, res) => {
  try {
    const { status, lost_reason } = req.body;
    if (!LEAD_STATUSES.includes(status)) return res.status(400).json({ error: 'Trang thai lead khong hop le.' });
    if (status === 'lost' && !lost_reason?.trim()) {
      return res.status(400).json({ error: 'Can nhap ly do that bai.' });
    }

    const { data: existing } = await supabase
      .from('broker_leads')
      .select('id, status')
      .eq('id', req.params.id)
      .eq('broker_id', req.user.id)
      .single();

    if (!existing) return res.status(404).json({ error: 'Lead khong ton tai.' });

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
    await logActivity({
      actorId: req.user.id,
      action: 'broker_lead_status_updated',
      targetType: 'broker_lead',
      targetId: req.params.id,
      oldValue: { status: existing.status },
      newValue: { status },
    });
    return res.status(200).json({ message: 'Da cap nhat trang thai lead.', lead: data });
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
    if (!count) return res.status(404).json({ error: 'Lead khong ton tai.' });
    return res.status(200).json({ message: 'Da xoa lead.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const recommendRoom = async (req, res) => {
  try {
    const { room_id, match_reason, tenant_feedback, status = 'suggested' } = req.body;
    if (!room_id) return res.status(400).json({ error: 'room_id la bat buoc.' });
    if (!RECOMMENDATION_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Trang thai phong goi y khong hop le.' });
    }

    const { data: lead } = await supabase
      .from('broker_leads')
      .select('id')
      .eq('id', req.params.id)
      .eq('broker_id', req.user.id)
      .single();

    if (!lead) return res.status(404).json({ error: 'Lead khong ton tai.' });

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
    return res.status(200).json({ message: 'Da goi y phong cho lead.', recommendation: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const updateRecommendation = async (req, res) => {
  try {
    const { status, match_reason, tenant_feedback } = req.body;
    if (status && !RECOMMENDATION_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Trang thai phong goi y khong hop le.' });
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
    return res.status(200).json({ message: 'Da cap nhat phong goi y.', recommendation: data });
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
    if (!count) return res.status(404).json({ error: 'Phong goi y khong ton tai.' });
    return res.status(200).json({ message: 'Da xoa phong goi y.' });
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
  listAssignedRooms,
};
