const supabase = require('../config/supabaseClient');

const STATUS_RANK = {
  new: 0,
  consulted: 1,
  scheduled: 2,
  visited: 3,
  deposit_ready: 4,
  closed: 5,
  lost: 0,
};

const COMMISSION_RATE_DEFAULT = 0.5;

const isMissingBrokerCommissionsTable = (error) => {
  const message = error?.message || '';
  return message.includes("Could not find the table 'public.broker_commissions'")
    || message.includes('relation "public.broker_commissions" does not exist')
    || message.includes('schema cache');
};

const chooseStatus = (currentStatus, nextStatus) => {
  if (nextStatus === 'lost' && currentStatus !== 'closed') return 'lost';
  return (STATUS_RANK[nextStatus] || 0) >= (STATUS_RANK[currentStatus] || 0)
    ? nextStatus
    : currentStatus;
};

const buildLeadNote = (currentNote, eventNote) => {
  const cleanNote = eventNote?.trim();
  if (!cleanNote) return currentNote || null;
  if (currentNote?.includes(cleanNote)) return currentNote;
  return [currentNote, cleanNote].filter(Boolean).join('\n');
};

const syncBrokerLeadFromTenantAction = async ({
  brokerId,
  tenantId,
  roomId,
  status,
  note,
}) => {
  if (!brokerId || !tenantId || !roomId) return { skipped: true };

  const [{ data: tenant, error: tenantError }, { data: room, error: roomError }] = await Promise.all([
    supabase
      .from('users')
      .select('id, full_name, email, phone')
      .eq('id', tenantId)
      .maybeSingle(),
    supabase
      .from('rooms')
      .select('id, title, city, area, price')
      .eq('id', roomId)
      .maybeSingle(),
  ]);

  if (tenantError) return { error: tenantError };
  if (roomError) return { error: roomError };
  if (!tenant || !room) return { skipped: true };

  const { data: existing, error: existingError } = await supabase
    .from('broker_leads')
    .select('id, status, note')
    .eq('broker_id', brokerId)
    .eq('tenant_id', tenantId)
    .eq('assigned_room_id', roomId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) return { error: existingError };

  const payload = {
    broker_id: brokerId,
    tenant_id: tenantId,
    assigned_room_id: roomId,
    full_name: tenant.full_name || tenant.email || 'Khách thuê',
    phone: tenant.phone || 'Chưa cập nhật',
    email: tenant.email || null,
    preferred_city: room.city || null,
    preferred_area: room.area || null,
    budget_min: room.price ? Math.max(Number(room.price) - 500000, 0) : null,
    budget_max: room.price ? Number(room.price) + 500000 : null,
    occupants: 1,
    has_pets: false,
    status: existing ? chooseStatus(existing.status, status) : status,
    lost_reason: status === 'lost' ? (note?.trim() || 'Khach khong con phu hop voi phong nay.') : null,
    note: buildLeadNote(existing?.note, note),
    updated_at: new Date().toISOString(),
  };

  const query = existing
    ? supabase.from('broker_leads').update(payload).eq('id', existing.id)
    : supabase.from('broker_leads').insert(payload);

  const { data: lead, error: leadError } = await query.select('id, status').single();
  if (leadError) return { error: leadError };

  await supabase
    .from('broker_lead_rooms')
    .upsert({
      lead_id: lead.id,
      room_id: roomId,
      broker_id: brokerId,
      match_reason: note || `Khách đã chọn phòng "${room.title}".`,
      status: status === 'scheduled' ? 'visited' : status === 'deposit_ready' || status === 'closed' ? 'deposit_ready' : 'interested',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'lead_id,room_id' });

  return { lead };
};

const createBrokerCommissionFromDeposit = async ({
  brokerId,
  tenantId,
  roomId,
  leadId,
  amount,
  note,
}) => {
  if (!brokerId || !tenantId || !roomId || !leadId) return { skipped: true };

  const basisAmount = Number(amount || 0);
  const commissionAmount = Math.round(basisAmount * COMMISSION_RATE_DEFAULT);
  if (!Number.isFinite(commissionAmount) || commissionAmount <= 0) return { skipped: true };

  const { data, error } = await supabase
    .from('broker_commissions')
    .upsert({
      lead_id: leadId,
      broker_id: brokerId,
      room_id: roomId,
      tenant_id: tenantId,
      amount: commissionAmount,
      commission_rate: COMMISSION_RATE_DEFAULT,
      basis_amount: basisAmount,
      status: 'pending_collection',
      note: note || 'Tự tạo khi khách đã cọc phòng.',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'lead_id' })
    .select('id')
    .single();

  if (error) {
    if (isMissingBrokerCommissionsTable(error)) return { skipped: true, missingTable: true };
    return { error };
  }

  return { commission: data };
};

module.exports = {
  syncBrokerLeadFromTenantAction,
  createBrokerCommissionFromDeposit,
};
