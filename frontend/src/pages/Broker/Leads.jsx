import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { brokerService } from '../../services/brokerService';
import { appointmentService } from '../../services/appointmentService';
import { formatCurrency, formatDate } from '../../utils/format';
import { useDialog } from '../../context/DialogContext';
import { useToast } from '../../context/ToastContext';

const LEAD_STATUSES = [
  { value: 'new', label: 'Moi' },
  { value: 'consulted', label: 'Da tu van' },
  { value: 'scheduled', label: 'Da hen xem' },
  { value: 'visited', label: 'Da xem phong' },
  { value: 'deposit_ready', label: 'Muon coc' },
  { value: 'closed', label: 'Da chot' },
  { value: 'lost', label: 'That bai' },
];

const ROOM_STATUSES = [
  { value: 'suggested', label: 'Da goi y' },
  { value: 'interested', label: 'Khach quan tam' },
  { value: 'visited', label: 'Da xem' },
  { value: 'deposit_ready', label: 'Muon coc' },
  { value: 'rejected', label: 'Khong phu hop' },
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
      toast.error(err.response?.data?.error || 'Khong tai duoc du lieu broker.');
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
        toast.success('Da cap nhat lead.');
      } else {
        await brokerService.createLead(payload);
        toast.success('Da tao lead.');
      }
      closeForm();
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Luu lead that bai.');
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (lead, status) => {
    let lostReason = '';
    let commission = {};
    if (status === 'closed') {
      const defaultAmount = Math.round(Number(lead.assigned_room?.price || lead.recommended_rooms?.[0]?.room?.price || 0) * 0.5);
      const amount = await dialog.prompt({
        title: 'Tao hoa hong moi gioi',
        label: 'So tien hoa hong',
        inputType: 'number',
        placeholder: defaultAmount ? String(defaultAmount) : 'VD: 1000000',
        confirmText: 'Chot lead',
      });
      if (amount === null) return;
      commission = { commission_amount: amount || defaultAmount };
      const note = await dialog.prompt({
        title: 'Ghi chu hoa hong',
        label: 'Ghi chu tuy chon',
        placeholder: 'VD: Thu khi landlord xac nhan coc...',
        required: false,
        confirmText: 'Luu ghi chu',
      });
      if (note === null) return;
      commission.commission_note = note;
    }
    if (status === 'lost') {
      lostReason = await dialog.prompt({
        title: 'Ly do that bai',
        label: 'Ly do',
        placeholder: 'VD: Khach chon phong khac, vuot ngan sach...',
        confirmText: 'Cap nhat',
      });
      if (!lostReason?.trim()) return;
    }
    setActiveLeadId(lead.id);
    try {
      await brokerService.updateLeadStatus(lead.id, status, lostReason?.trim(), commission);
      await load();
      toast.success('Da cap nhat trang thai lead.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Cap nhat trang thai that bai.');
    } finally {
      setActiveLeadId(null);
    }
  };

  const addRecommendation = async (lead) => {
    if (!rooms.length) {
      toast.warning('Broker chua co phong duoc admin phan cong.');
      return;
    }
    const roomId = recommendationDraft[lead.id] || rooms[0]?.id;
    if (!roomId) return;
    const matchReason = await dialog.prompt({
      title: 'Ly do phu hop',
      label: 'Ly do',
      placeholder: 'VD: Gan khu vuc mong muon, dung ngan sach, cho nuoi pet...',
      confirmText: 'Goi y phong',
    });
    setActiveLeadId(lead.id);
    try {
      await brokerService.recommendRoom(lead.id, {
        room_id: roomId,
        match_reason: matchReason?.trim() || '',
      });
      await load();
      toast.success('Da goi y phong cho lead.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Goi y phong that bai.');
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
      toast.success('Da cap nhat phong goi y.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Cap nhat phong goi y that bai.');
    } finally {
      setActiveLeadId(null);
    }
  };

  const createAppointment = async (lead, roomId) => {
    if (!lead.tenant_id) {
      toast.warning('Lead can lien ket tenant_id de tao lich hen tren he thong.');
      return;
    }
    const scheduledAt = await dialog.prompt({
      title: 'Tao lich xem phong',
      label: 'Thoi gian xem phong',
      inputType: 'datetime-local',
      confirmText: 'Tao lich',
    });
    if (!scheduledAt) return;
    setActiveLeadId(lead.id);
    try {
      await appointmentService.create(roomId, new Date(scheduledAt).toISOString(), lead.tenant_id);
      await brokerService.updateLeadStatus(lead.id, 'scheduled');
      await load();
      toast.success('Da tao lich xem phong.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Tao lich xem phong that bai.');
    } finally {
      setActiveLeadId(null);
    }
  };

  return (
    <div className="broker-leads">
      <div className="container">
        <header className="bl-head">
          <div>
            <h1>Quan ly lead khach thue</h1>
            <p>Ghi nhan nhu cau, goi y phong duoc giao va theo doi qua trinh chot.</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={openCreate}>Them lead</button>
        </header>

        <section className="bl-summary">
          {[{ value: 'all', label: 'Tat ca' }, ...LEAD_STATUSES].map(item => (
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
            placeholder="Tim ten, SDT, khu vuc..."
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
        </div>

        {formOpen && (
          <form className="bl-form" onSubmit={submitLead}>
            <div className="bl-form-head">
              <h2>{editing ? 'Sua lead' : 'Them lead moi'}</h2>
              <button type="button" className="btn btn-ghost btn-sm" onClick={closeForm}>Dong</button>
            </div>
            <div className="bl-form-grid">
              <label>Ten khach<input className="form-input" required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></label>
              <label>So dien thoai<input className="form-input" required value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></label>
              <label>Email<input className="form-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
              <label>Tenant ID<input className="form-input" value={form.tenant_id || ''} onChange={e => setForm({ ...form, tenant_id: e.target.value })} placeholder="Neu co tai khoan tenant" /></label>
              <label>Ngan sach tu<input className="form-input" type="number" min="0" value={form.budget_min} onChange={e => setForm({ ...form, budget_min: e.target.value })} /></label>
              <label>Ngan sach den<input className="form-input" type="number" min="0" value={form.budget_max} onChange={e => setForm({ ...form, budget_max: e.target.value })} /></label>
              <label>Thanh pho<input className="form-input" value={form.preferred_city} onChange={e => setForm({ ...form, preferred_city: e.target.value })} /></label>
              <label>Khu vuc mong muon<input className="form-input" value={form.preferred_area} onChange={e => setForm({ ...form, preferred_area: e.target.value })} /></label>
              <label>Ngay muon vao<input className="form-input" type="date" value={form.move_in_date} onChange={e => setForm({ ...form, move_in_date: e.target.value })} /></label>
              <label>So nguoi<input className="form-input" type="number" min="1" value={form.occupants} onChange={e => setForm({ ...form, occupants: e.target.value })} /></label>
              <label>Trang thai
                <select className="form-input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  {LEAD_STATUSES.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}
                </select>
              </label>
              <label>Phong dang tu van
                <select className="form-input" value={form.assigned_room_id} onChange={e => setForm({ ...form, assigned_room_id: e.target.value })}>
                  <option value="">Chua chon phong</option>
                  {rooms.map(room => <option key={room.id} value={room.id}>{room.title}</option>)}
                </select>
              </label>
              <label className="bl-check"><input type="checkbox" checked={form.has_pets} onChange={e => setForm({ ...form, has_pets: e.target.checked })} /> Co thu cung</label>
              <label className="bl-wide">Ghi chu<textarea className="form-input" rows={3} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></label>
            </div>
            <button className="btn btn-primary" disabled={saving}>{saving ? 'Dang luu...' : 'Luu lead'}</button>
          </form>
        )}

        {loading ? (
          <p className="bl-muted">Dang tai...</p>
        ) : filteredLeads.length === 0 ? (
          <div className="bl-empty">
            <h3>Chua co lead phu hop</h3>
            <p>Broker co the them lead khach thue tu cuoc goi, chat hoac khach den xem phong.</p>
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
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(lead)}>Sua</button>
                      <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => addRecommendation(lead)}>Goi y phong</button>
                    </div>
                  </div>

                  <div className="bl-meta">
                    <span>Ngan sach: {lead.budget_min || lead.budget_max ? `${formatCurrency(lead.budget_min || 0)} - ${formatCurrency(lead.budget_max || 0)}` : 'Chua co'}</span>
                    <span>Khu vuc: {lead.preferred_area || lead.preferred_city || 'Chua co'}</span>
                    <span>So nguoi: {lead.occupants || 1}</span>
                    <span>Thu cung: {lead.has_pets ? 'Co' : 'Khong'}</span>
                    {lead.move_in_date && <span>Muon vao: {formatDate(lead.move_in_date)}</span>}
                  </div>

                  {lead.note && <p className="bl-note">{lead.note}</p>}
                  {lead.commission?.length ? (
                    <div className="bl-note">
                      Hoa hong: {formatCurrency(lead.commission[0].amount)} - {lead.commission[0].status}
                    </div>
                  ) : null}

                  <div className="bl-status-actions">
                    {LEAD_STATUSES.filter(item => item.value !== lead.status).map(item => (
                      <button type="button" key={item.value} className="btn btn-ghost btn-sm" disabled={busy} onClick={() => changeStatus(lead, item.value)}>
                        {item.label}
                      </button>
                    ))}
                  </div>

                  <div className="bl-recs">
                    <div className="bl-recs-head">
                      <h3>Phong da goi y</h3>
                      <div className="bl-add-rec">
                        <select value={recommendationDraft[lead.id] || rooms[0]?.id || ''} onChange={e => setRecommendationDraft(prev => ({ ...prev, [lead.id]: e.target.value }))}>
                          {rooms.map(room => <option key={room.id} value={room.id}>{room.title}</option>)}
                        </select>
                        <button type="button" className="btn btn-ghost btn-sm" disabled={busy || !rooms.length} onClick={() => addRecommendation(lead)}>Them goi y</button>
                      </div>
                    </div>
                    {lead.recommended_rooms?.length ? lead.recommended_rooms.map(rec => (
                      <div className="bl-rec" key={rec.id}>
                        <div>
                          <Link to={`/rooms/${rec.room_id}`}>{rec.room?.title || rec.room_id}</Link>
                          <p>{rec.room ? `${formatCurrency(rec.room.price)}/thang · ${rec.room.address}, ${rec.room.city}` : ''}</p>
                          {rec.match_reason && <small>Ly do: {rec.match_reason}</small>}
                        </div>
                        <div className="bl-rec-actions">
                          <select value={rec.status} disabled={busy} onChange={e => updateRecommendationStatus(lead, rec, e.target.value)}>
                            {ROOM_STATUSES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                          </select>
                          <button type="button" className="btn btn-sm" disabled={busy || !lead.tenant_id} onClick={() => createAppointment(lead, rec.room_id)}>
                            Tao lich xem
                          </button>
                        </div>
                        <span className="bl-rec-badge">{roomStatusLabel(rec.status)}</span>
                      </div>
                    )) : <p className="bl-muted">Chua goi y phong nao.</p>}
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
