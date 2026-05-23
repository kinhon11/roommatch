import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { brokerService } from '../../services/brokerService';
import { appointmentService } from '../../services/appointmentService';
import { formatCurrency, formatDate } from '../../utils/format';
import { useDialog } from '../../context/DialogC?ntext';
import { useToast } from '../../context/ToastC?ntext';

const LEAD_STATUSES = [
  { value: 'new', label: 'Mới' },
  { value: 'consulted', label: 'Đã tư vấn' },
  { value: 'scheduled', label: 'Đã hẹn xem' },
  { value: 'visited', label: 'Đã xem phòng' },
  { value: 'deposit_ready', label: 'Muốn cọc' },
  { value: 'closed', label: 'Đã chốt' },
  { value: 'lost', label: 'Thất bại' },
];

const ROOM_STATUSES = [
  { value: 'suggested', label: 'Đã gợi ý' },
  { value: 'interested', label: 'Khách quan tâm' },
  { value: 'visited', label: 'Đã xem' },
  { value: 'deposit_ready', label: 'Muốn cọc' },
  { value: 'rejected', label: 'Không phù hợp' },
];

const emptyLead = {
  full_name: '',
  phone: '',
  email: '',
  budget_min: '',
  budget_max: '',
  preferred_city: '',
  preferred_area: '',
  move_in_date: '',
  occupants: 1,
  has_pets: false,
  status: 'new',
  tenant_id: '',
  assigned_room_id: '',
  note: '',
};

const BrokerLeads = () => {
  const [leads, setLeads] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyLead);
  const [saving, setSaving] = useState(false);
  const [activeLeadId, setActiveLeadId] = useState(null);
  const [recommendationDraft, setRecommendationDraft] = useState({});
  const dialog = useDialog();
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [leadRes, roomRes] = await Promise.all([
        brokerService.listLeads(),
        brokerService.listRooms(),
      ]);
      setLeads(leadRes.data || []);
      setRooms(roomRes.data || []);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Kh?ng t?i ???c d? li?u broker.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const statusLabel = (value) => LEAD_STATUSES.find(item => item.value === value)?.label || value;
  const roomStatusLabel = (value) => ROOM_STATUSES.find(item => item.value === value)?.label || value;

  const filteredLeads = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return leads.filter(lead => {
      const matchStatus = filter === 'all' || lead.status === filter;
      const matchSearch = !normalizedSearch
        || lead.full_name?.toLowerCase().includes(normalizedSearch)
        || lead.phone?.toLowerCase().includes(normalizedSearch)
        || lead.preferred_area?.toLowerCase().includes(normalizedSearch);
      return matchStatus && matchSearch;
    });
  }, [leads, filter, search]);

  const counts = LEAD_STATUSES.reduce((acc, item) => {
    acc[item.value] = leads.filter(lead => lead.status === item.value).length;
    return acc;
  }, { all: leads.length });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyLead);
    setFormOpen(true);
  };

  const openEdit = (lead) => {
    setEditing(lead);
    setFormOpen(true);
    setForm({
      full_name: lead.full_name || '',
      phone: lead.phone || '',
      email: lead.email || '',
      budget_min: lead.budget_min ?? '',
      budget_max: lead.budget_max ?? '',
      preferred_city: lead.preferred_city || '',
      preferred_area: lead.preferred_area || '',
      move_in_date: lead.move_in_date || '',
      occupants: lead.occupants || 1,
      has_pets: !!lead.has_pets,
      status: lead.status || 'new',
      tenant_id: lead.tenant_id || '',
      assigned_room_id: lead.assigned_room_id || '',
      note: lead.note || '',
      lost_reason: lead.lost_reason || '',
    });
  };

  const closeForm = () => {
    setEditing(null);
    setForm(emptyLead);
    setFormOpen(false);
  };

  const submitLead = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        assigned_room_id: form.assigned_room_id || null,
        budget_min: form.budget_min === '' ? null : Number(form.budget_min),
        budget_max: form.budget_max === '' ? null : Number(form.budget_max),
        occupants: Number(form.occupants || 1),
      };
      if (editing) {
        await brokerService.updateLead(editing.id, payload);
        toast.success('?? c?p nh?t lead.');
      } else {
        await brokerService.createLead(payload);
        toast.success('?? t?o lead.');
      }
      closeForm();
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'L?u lead th?t b?i.');
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (lead, status) => {
    let lostReason = '';
    if (status === 'lost') {
      lostReason = await dialog.prompt({
        title: 'L? do th?t b?i',
        label: 'L? do',
        placeholder: 'VD: Kh?ch ch?n ph?ng kh?c, v??t ng?n s?ch...',
        confirmText: 'C?p nh?t',
      });
      if (!lostReason?.trim()) return;
    }
    setActiveLeadId(lead.id);
    try {
      await brokerService.updateLeadStatus(lead.id, status, lostReason?.trim());
      await load();
      toast.success('?? c?p nh?t tr?ng th?i lead.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'C?p nh?t tr?ng th?i th?t b?i.');
    } finally {
      setActiveLeadId(null);
    }
  };

  const addRecommendation = async (lead) => {
    if (!rooms.length) {
      toast.warning('Broker ch?a c? ph?ng ???c admin ph?n c?ng.');
      return;
    }
    const roomId = recommendationDraft[lead.id] || rooms[0]?.id;
    if (!roomId) return;
    const matchReason = await dialog.prompt({
      title: 'L? do ph? h?p',
      label: 'L? do',
      placeholder: 'VD: G?n khu v?c mong mu?n, ??ng ng?n s?ch, cho nu?i pet...',
      confirmText: 'G?i ? ph?ng',
    });
    setActiveLeadId(lead.id);
    try {
      await brokerService.recommendRoom(lead.id, {
        room_id: roomId,
        match_reason: matchReason?.trim() || '',
      });
      await load();
      toast.success('?? g?i ? ph?ng cho lead.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'G?i ? ph?ng th?t b?i.');
    } finally {
      setActiveLeadId(null);
    }
  };

  const updateRecommendationStatus = async (lead, recommendation, status) => {
    setActiveLeadId(lead.id);
    try {
      await brokerService.updateRecommendation(lead.id, recommendation.id, {
        status,
        match_reason: recommendation.match_reason,
        tenant_feedback: recommendation.tenant_feedback,
      });
      await load();
      toast.success('?? c?p nh?t ph?ng g?i ?.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Cập nhật phòng gợi ý thất bại.');
    } finally {
      setActiveLeadId(null);
    }
  };

  const createAppointment = async (lead, roomId) => {
    if (!lead.tenant_id) {
      toast.warning('Lead c?n li?n k?t tenant_id ?? t?o l?ch h?n tr?n h? th?ng.');
      return;
    }
    const scheduledAt = await dialog.prompt({
      title: 'T?o l?ch xem ph?ng',
      label: 'Th?i gian xem ph?ng',
      inputType: 'datetime-local',
      confirmText: 'T?o l?ch',
    });
    if (!scheduledAt) return;
    setActiveLeadId(lead.id);
    try {
      await appointmentService.create(roomId, new Date(scheduledAt).toISOString(), lead.tenant_id);
      await brokerService.updateLeadStatus(lead.id, 'scheduled');
      await load();
      toast.success('?? t?o l?ch xem ph?ng.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'T?o l?ch xem ph?ng th?t b?i.');
    } finally {
      setActiveLeadId(null);
    }
  };

  return (
    <div className="broker-leads">
      <div className="container">
        <header className="bl-head">
          <div>
            <h1>Qu?n l? lead kh?ch thu?</h1>
            <p>Ghi nh?n nhu c?u, g?i ? ph?ng ???c giao v? theo d?i qu? tr?nh ch?t.</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={openCreate}>Th?m lead</button>
        </header>

        <section className="bl-summary">
          {[{ value: 'all', label: 'T?t c?' }, ...LEAD_STATUSES].map(item => (
            <button
              key={item.value}
              className={`bl-chip ${filter === item.value ? 'active' : ''}`}
              onClick={() => setFilter(item.value)}
            >
              {item.label}
              <span>{counts[item.value] || 0}</span>
            </button>
          ))}
        </section>

        <div className="bl-toolbar">
          <input
            className="form-input"
            placeholder="T?m t?n, SDT, khu v?c..."
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
        </div>

        {formOpen && (
          <form className="bl-form" onSubmit={submitLead}>
            <div className="bl-form-head">
              <h2>{editing ? 'S?a lead' : 'Th?m lead m?i'}</h2>
              <button type="button" className="btn btn-ghost btn-sm" onClick={closeForm}>??ng</button>
            </div>
            <div className="bl-form-grid">
              <label>T?n kh?ch<input className="form-input" required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></label>
              <label>S? ?i?n tho?i<input className="form-input" required value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></label>
              <label>Email<input className="form-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
              <label>Tenant ID<input className="form-input" value={form.tenant_id || ''} onChange={e => setForm({ ...form, tenant_id: e.target.value })} placeholder="Neu co tai khoan tenant" /></label>
              <label>Ng?n s?ch t?<input className="form-input" type="number" min="0" value={form.budget_min} onChange={e => setForm({ ...form, budget_min: e.target.value })} /></label>
              <label>Ng?n s?ch ??n<input className="form-input" type="number" min="0" value={form.budget_max} onChange={e => setForm({ ...form, budget_max: e.target.value })} /></label>
              <label>Th?nh ph?<input className="form-input" value={form.preferred_city} onChange={e => setForm({ ...form, preferred_city: e.target.value })} /></label>
              <label>Khu v?c mong mu?n<input className="form-input" value={form.preferred_area} onChange={e => setForm({ ...form, preferred_area: e.target.value })} /></label>
              <label>Ng?y mu?n v?o<input className="form-input" type="date" value={form.move_in_date} onChange={e => setForm({ ...form, move_in_date: e.target.value })} /></label>
              <label>S? ng??i<input className="form-input" type="number" min="1" value={form.occupants} onChange={e => setForm({ ...form, occupants: e.target.value })} /></label>
              <label>Tr?ng th?i
                <select className="form-input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  {LEAD_STATUSES.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}
                </select>
              </label>
              <label>Ph?ng ?ang t? v?n
                <select className="form-input" value={form.assigned_room_id} onChange={e => setForm({ ...form, assigned_room_id: e.target.value })}>
                  <option value="">Ch?a ch?n ph?ng</option>
                  {rooms.map(room => <option key={room.id} value={room.id}>{room.title}</option>)}
                </select>
              </label>
              <label className="bl-check"><input type="checkbox" checked={form.has_pets} onChange={e => setForm({ ...form, has_pets: e.target.checked })} /> C? th? c?ng</label>
              <label className="bl-wide">Ghi ch?<textarea className="form-input" rows={3} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></label>
            </div>
            <button className="btn btn-primary" disabled={saving}>{saving ? '?ang l?u...' : 'L?u lead'}</button>
          </form>
        )}

        {loading ? (
          <p className="bl-muted">?ang t?i...</p>
        ) : filteredLeads.length === 0 ? (
          <div className="bl-empty">
            <h3>Ch?a c? lead ph? h?p</h3>
            <p>Broker c? th? th?m lead kh?ch thu? t? cu?c g?i, chat ho?c kh?ch ??n xem ph?ng.</p>
          </div>
        ) : (
          <div className="bl-list">
            {filteredLeads.map(lead => {
              const busy = activeLeadId === lead.id;
              return (
                <article className="bl-card" key={lead.id}>
                  <div className="bl-card-main">
                    <div>
                      <span className={`bl-status bl-status--${lead.status}`}>{statusLabel(lead.status)}</span>
                      <h2>{lead.full_name}</h2>
                      <p>{lead.phone}{lead.email ? ` · ${lead.email}` : ''}</p>
                    </div>
                    <div className="bl-card-actions">
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(lead)}>S?a</button>
                      <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => addRecommendation(lead)}>G?i ? ph?ng</button>
                    </div>
                  </div>

                  <div className="bl-meta">
                    <span>Ng?n s?ch: {lead.budget_min || lead.budget_max ? `${formatCurrency(lead.budget_min || 0)} - ${formatCurrency(lead.budget_max || 0)}` : 'Ch?a c?'}</span>
                    <span>Khu v?c: {lead.preferred_area || lead.preferred_city || 'Ch?a c?'}</span>
                    <span>S? ng??i: {lead.occupants || 1}</span>
                    <span>Th? c?ng: {lead.has_pets ? 'C?' : 'Kh?ng'}</span>
                    {lead.move_in_date && <span>Mu?n v?o: {formatDate(lead.move_in_date)}</span>}
                  </div>

                  {lead.note && <p className="bl-note">{lead.note}</p>}

                  <div className="bl-status-actions">
                    {LEAD_STATUSES.filter(item => item.value !== lead.status).map(item => (
                      <button type="button" key={item.value} className="btn btn-ghost btn-sm" disabled={busy} onClick={() => changeStatus(lead, item.value)}>
                        {item.label}
                      </button>
                    ))}
                  </div>

                  <div className="bl-recs">
                    <div className="bl-recs-head">
                      <h3>Ph?ng ?? g?i ?</h3>
                      <div className="bl-add-rec">
                        <select value={recommendationDraft[lead.id] || rooms[0]?.id || ''} onChange={e => setRecommendationDraft(prev => ({ ...prev, [lead.id]: e.target.value }))}>
                          {rooms.map(room => <option key={room.id} value={room.id}>{room.title}</option>)}
                        </select>
                        <button type="button" className="btn btn-ghost btn-sm" disabled={busy || !rooms.length} onClick={() => addRecommendation(lead)}>Th?m g?i ?</button>
                      </div>
                    </div>
                    {lead.recommended_rooms?.length ? lead.recommended_rooms.map(rec => (
                      <div className="bl-rec" key={rec.id}>
                        <div>
                          <Link to={`/rooms/${rec.room_id}`}>{rec.room?.title || rec.room_id}</Link>
                          <p>{rec.room ? `${formatCurrency(rec.room.price)}/th?ng · ${rec.room.address}, ${rec.room.city}` : ''}</p>
                          {rec.match_reason && <small>L? do: {rec.match_reason}</small>}
                        </div>
                        <div className="bl-rec-actions">
                          <select value={rec.status} disabled={busy} onChange={e => updateRecommendationStatus(lead, rec, e.target.value)}>
                            {ROOM_STATUSES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                          </select>
                          <button type="button" className="btn btn-sm" disabled={busy || !lead.tenant_id} onClick={() => createAppointment(lead, rec.room_id)}>
                            T?o l?ch xem
                          </button>
                        </div>
                        <span className="bl-rec-badge">{roomStatusLabel(rec.status)}</span>
                      </div>
                    )) : <p className="bl-muted">Ch?a g?i ? ph?ng n?o.</p>}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        .broker-leads { padding:32px 0 80px; }
        .bl-head { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:20px; }
        .bl-head h1 { font-size:26px; font-weight:800; color:var(--text-primary); }
        .bl-head p, .bl-muted { color:var(--text-secondary); font-size:14px; }
        .bl-summary { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px; }
        .bl-chip { display:flex; align-items:center; gap:8px; padding:8px 12px; border:1px solid var(--border); border-radius:var(--radius-full); background:var(--bg-card); color:var(--text-secondary); font-weight:700; cursor:pointer; }
        .bl-chip.active { background:var(--primary); border-color:var(--primary); color:#fff; }
        .bl-chip span { min-width:22px; text-align:center; padding:1px 6px; border-radius:var(--radius-full); background:rgba(255,255,255,.16); }
        .bl-toolbar { margin-bottom:18px; }
        .bl-form, .bl-card, .bl-empty { background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-lg); padding:18px; }
        .bl-form { margin-bottom:20px; }
        .bl-form-head, .bl-card-main { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:14px; }
        .bl-form h2, .bl-card h2 { color:var(--text-primary); font-size:18px; font-weight:800; }
        .bl-form-grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:12px; margin-bottom:14px; }
        .bl-form-grid label { color:var(--text-secondary); font-size:13px; font-weight:700; display:flex; flex-direction:column; gap:6px; }
        .bl-check { justify-content:center; flex-direction:row !important; align-items:center; }
        .bl-wide { grid-column:1 / -1; }
        .bl-list { display:flex; flex-direction:column; gap:14px; }
        .bl-card-main p, .bl-note { color:var(--text-secondary); font-size:13px; margin-top:4px; }
        .bl-card-actions, .bl-status-actions, .bl-rec-actions { display:flex; gap:8px; flex-wrap:wrap; }
        .bl-status { display:inline-flex; padding:3px 9px; border-radius:var(--radius-full); background:var(--primary-50); color:var(--primary-dark); font-size:11px; font-weight:800; margin-bottom:6px; }
        .bl-status--closed { background:rgba(16,185,129,.15); color:var(--success); }
        .bl-status--lost { background:rgba(239,68,68,.12); color:var(--danger); }
        .bl-meta { display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; margin:12px 0; }
        .bl-meta span { background:var(--bg-warm); border:1px solid var(--border); border-radius:var(--radius-sm); padding:8px 10px; color:var(--text-secondary); font-size:12px; }
        .bl-note { padding:10px 12px; border-left:3px solid var(--primary); background:var(--bg-warm); border-radius:var(--radius-sm); }
        .bl-status-actions { margin:12px 0; padding-top:12px; border-top:1px solid var(--border); }
        .bl-recs { margin-top:12px; }
        .bl-recs-head { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:10px; }
        .bl-recs h3 { color:var(--text-primary); font-size:14px; font-weight:800; }
        .bl-add-rec { display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; }
        .bl-add-rec select { max-width:240px; border:1px solid var(--border); border-radius:var(--radius-sm); padding:7px 9px; background:var(--bg-card); color:var(--text-primary); }
        .bl-rec { position:relative; display:flex; align-items:flex-start; justify-content:space-between; gap:12px; border:1px solid var(--border); border-radius:var(--radius-md); padding:12px; margin-top:8px; background:var(--bg-warm); }
        .bl-rec a { color:var(--primary); font-weight:800; }
        .bl-rec p, .bl-rec small { display:block; color:var(--text-secondary); font-size:12px; margin-top:4px; }
        .bl-rec select { border:1px solid var(--border); border-radius:var(--radius-sm); padding:7px 9px; background:var(--bg-card); color:var(--text-primary); }
        .bl-rec-badge { position:absolute; top:10px; right:10px; transform:translateY(-100%); background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-full); padding:2px 8px; font-size:11px; color:var(--text-muted); }
        .bl-empty { text-align:center; padding:42px 20px; color:var(--text-secondary); }
        @media(max-width:900px){ .bl-form-grid, .bl-meta { grid-template-columns:1fr; } .bl-card-main, .bl-rec { flex-direction:column; } }
      `}</style>
    </div>
  );
};

export default BrokerLeads;
