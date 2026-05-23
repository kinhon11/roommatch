import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { brokerService } from '../../services/brokerService';
import { appointmentService } from '../../services/appointmentService';
import { formatCurrency, formatDate } from '../../utils/format';
import { useDialog } from '../../context/DialogContext';
import { useToast } from '../../context/ToastContext';

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
      toast.error(err.response?.data?.error || 'Không tải được dữ liệu broker.');
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
        toast.success('Đã cập nhật lead.');
      } else {
        await brokerService.createLead(payload);
        toast.success('Đã tạo lead.');
      }
      closeForm();
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lưu lead thất bại.');
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (lead, status) => {
    let lostReason = '';
    if (status === 'lost') {
      lostReason = await dialog.prompt({
        title: 'Lý do thất bại',
        label: 'Lý do',
        placeholder: 'VD: Khách chọn phòng khác, vượt ngân sách...',
        confirmText: 'Cập nhật',
      });
      if (!lostReason?.trim()) return;
    }
    setActiveLeadId(lead.id);
    try {
      await brokerService.updateLeadStatus(lead.id, status, lostReason?.trim());
      await load();
      toast.success('Đã cập nhật trạng thái lead.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Cập nhật trạng thái thất bại.');
    } finally {
      setActiveLeadId(null);
    }
  };

  const addRecommendation = async (lead) => {
    if (!rooms.length) {
      toast.warning('Broker chưa có phòng được admin phân công.');
      return;
    }
    const roomId = recommendationDraft[lead.id] || rooms[0]?.id;
    if (!roomId) return;
    const matchReason = await dialog.prompt({
      title: 'Lý do phù hợp',
      label: 'Lý do',
      placeholder: 'VD: Gần khu vực mong muốn, đúng ngân sách, cho nuôi pet...',
      confirmText: 'Gợi ý phòng',
    });
    setActiveLeadId(lead.id);
    try {
      await brokerService.recommendRoom(lead.id, {
        room_id: roomId,
        match_reason: matchReason?.trim() || '',
      });
      await load();
      toast.success('Đã gợi ý phòng cho lead.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gợi ý phòng thất bại.');
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
      toast.success('Đã cập nhật phòng gợi ý.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Cập nhật phòng gợi ý thất bại.');
    } finally {
      setActiveLeadId(null);
    }
  };

  const createAppointment = async (lead, roomId) => {
    if (!lead.tenant_id) {
      toast.warning('Lead cần liên kết tenant_id để tạo lịch hẹn trên hệ thống.');
      return;
    }
    const scheduledAt = await dialog.prompt({
      title: 'Tạo lịch xem phòng',
      label: 'Thời gian xem phòng',
      inputType: 'datetime-local',
      confirmText: 'Tạo lịch',
    });
    if (!scheduledAt) return;
    setActiveLeadId(lead.id);
    try {
      await appointmentService.create(roomId, new Date(scheduledAt).toISOString(), lead.tenant_id);
      await brokerService.updateLeadStatus(lead.id, 'scheduled');
      await load();
      toast.success('Đã tạo lịch xem phòng.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Tạo lịch xem phòng thất bại.');
    } finally {
      setActiveLeadId(null);
    }
  };

  return (
    <div className="broker-leads">
      <div className="container">
        <header className="bl-head">
          <div>
            <h1>Quản lý lead khách thuê</h1>
            <p>Ghi nhận nhu cầu, gợi ý phòng được giao và theo dõi quá trình chốt.</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={openCreate}>Thêm lead</button>
        </header>

        <section className="bl-summary">
          {[{ value: 'all', label: 'Tất cả' }, ...LEAD_STATUSES].map(item => (
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
            placeholder="Tìm tên, SDT, khu vực..."
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
        </div>

        {formOpen && (
          <form className="bl-form" onSubmit={submitLead}>
            <div className="bl-form-head">
              <h2>{editing ? 'Sửa lead' : 'Thêm lead mới'}</h2>
              <button type="button" className="btn btn-ghost btn-sm" onClick={closeForm}>Đóng</button>
            </div>
            <div className="bl-form-grid">
              <label>Tên khách<input className="form-input" required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></label>
              <label>Số điện thoại<input className="form-input" required value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></label>
              <label>Email<input className="form-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
              <label>Tenant ID<input className="form-input" value={form.tenant_id || ''} onChange={e => setForm({ ...form, tenant_id: e.target.value })} placeholder="Nếu có tài khoản tenant" /></label>
              <label>Ngân sách từ<input className="form-input" type="number" min="0" value={form.budget_min} onChange={e => setForm({ ...form, budget_min: e.target.value })} /></label>
              <label>Ngân sách đến<input className="form-input" type="number" min="0" value={form.budget_max} onChange={e => setForm({ ...form, budget_max: e.target.value })} /></label>
              <label>Thành phố<input className="form-input" value={form.preferred_city} onChange={e => setForm({ ...form, preferred_city: e.target.value })} /></label>
              <label>Khu vực mong muốn<input className="form-input" value={form.preferred_area} onChange={e => setForm({ ...form, preferred_area: e.target.value })} /></label>
              <label>Ngày muốn vào<input className="form-input" type="date" value={form.move_in_date} onChange={e => setForm({ ...form, move_in_date: e.target.value })} /></label>
              <label>Số người<input className="form-input" type="number" min="1" value={form.occupants} onChange={e => setForm({ ...form, occupants: e.target.value })} /></label>
              <label>Trạng thái
                <select className="form-input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  {LEAD_STATUSES.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}
                </select>
              </label>
              <label>Phòng đang tư vấn
                <select className="form-input" value={form.assigned_room_id} onChange={e => setForm({ ...form, assigned_room_id: e.target.value })}>
                  <option value="">Chưa chọn phòng</option>
                  {rooms.map(room => <option key={room.id} value={room.id}>{room.title}</option>)}
                </select>
              </label>
              <label className="bl-check"><input type="checkbox" checked={form.has_pets} onChange={e => setForm({ ...form, has_pets: e.target.checked })} /> Có thú cưng</label>
              <label className="bl-wide">Ghi chú<textarea className="form-input" rows={3} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></label>
            </div>
            <button className="btn btn-primary" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu lead'}</button>
          </form>
        )}

        {loading ? (
          <p className="bl-muted">Đang tải...</p>
        ) : filteredLeads.length === 0 ? (
          <div className="bl-empty">
            <h3>Chưa có lead phù hợp</h3>
            <p>Broker có thể thêm lead khách thuê từ cuộc gọi, chat hoặc khách đến xem phòng.</p>
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
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(lead)}>Sửa</button>
                      <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => addRecommendation(lead)}>Gợi ý phòng</button>
                    </div>
                  </div>

                  <div className="bl-meta">
                    <span>Ngân sách: {lead.budget_min || lead.budget_max ? `${formatCurrency(lead.budget_min || 0)} - ${formatCurrency(lead.budget_max || 0)}` : 'Chưa có'}</span>
                    <span>Khu vực: {lead.preferred_area || lead.preferred_city || 'Chưa có'}</span>
                    <span>Số người: {lead.occupants || 1}</span>
                    <span>Thú cưng: {lead.has_pets ? 'Có' : 'Không'}</span>
                    {lead.move_in_date && <span>Muốn vào: {formatDate(lead.move_in_date)}</span>}
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
                      <h3>Phòng đã gợi ý</h3>
                      <div className="bl-add-rec">
                        <select value={recommendationDraft[lead.id] || rooms[0]?.id || ''} onChange={e => setRecommendationDraft(prev => ({ ...prev, [lead.id]: e.target.value }))}>
                          {rooms.map(room => <option key={room.id} value={room.id}>{room.title}</option>)}
                        </select>
                        <button type="button" className="btn btn-ghost btn-sm" disabled={busy || !rooms.length} onClick={() => addRecommendation(lead)}>Thêm gợi ý</button>
                      </div>
                    </div>
                    {lead.recommended_rooms?.length ? lead.recommended_rooms.map(rec => (
                      <div className="bl-rec" key={rec.id}>
                        <div>
                          <Link to={`/rooms/${rec.room_id}`}>{rec.room?.title || rec.room_id}</Link>
                          <p>{rec.room ? `${formatCurrency(rec.room.price)}/tháng · ${rec.room.address}, ${rec.room.city}` : ''}</p>
                          {rec.match_reason && <small>Lý do: {rec.match_reason}</small>}
                        </div>
                        <div className="bl-rec-actions">
                          <select value={rec.status} disabled={busy} onChange={e => updateRecommendationStatus(lead, rec, e.target.value)}>
                            {ROOM_STATUSES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                          </select>
                          <button type="button" className="btn btn-sm" disabled={busy || !lead.tenant_id} onClick={() => createAppointment(lead, rec.room_id)}>
                            Tạo lịch xem
                          </button>
                        </div>
                        <span className="bl-rec-badge">{roomStatusLabel(rec.status)}</span>
                      </div>
                    )) : <p className="bl-muted">Chưa gợi ý phòng nào.</p>}
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
