import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { appointmentService } from '../../services/appointmentService';
import { formatDate } from '../../utils/format';

const STATUS_MAP = {
  pending: { label: 'Cho xac nhan', cls: 'badge-pending' },
  confirmed: { label: 'Da xac nhan', cls: 'badge-approved' },
  completed: { label: 'Hoan thanh', cls: 'badge-approved' },
  cancelled: { label: 'Da huy', cls: 'badge-rejected' },
  no_show: { label: 'Khong den', cls: 'badge-rejected' },
};

const FILTERS = ['all', 'pending', 'confirmed', 'completed', 'cancelled', 'no_show'];

const AppointmentsPage = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const [filter, setFilter] = useState('all');
  const isLandlord = user?.role === 'landlord';

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await appointmentService.list();
      setAppointments(Array.isArray(data) ? data : []);
    } catch {
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (appointment, status) => {
    let reason;
    if (status === 'cancelled') {
      reason = window.prompt('Nhap ly do huy lich:');
      if (!reason?.trim()) return;
    }

    setActionId(appointment.id);
    try {
      await appointmentService.updateStatus(appointment.id, status, reason?.trim());
      await load();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    } finally {
      setActionId(null);
    }
  };

  const reschedule = async (appointment) => {
    const input = window.prompt('Nhap thoi gian moi theo dinh dang YYYY-MM-DDTHH:mm:', appointment.scheduled_at?.slice(0, 16));
    if (!input) return;

    setActionId(appointment.id);
    try {
      await appointmentService.reschedule(appointment.id, new Date(input).toISOString());
      await load();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    } finally {
      setActionId(null);
    }
  };

  const filtered = filter === 'all' ? appointments : appointments.filter(a => a.status === filter);
  const counts = FILTERS.reduce((acc, key) => {
    acc[key] = key === 'all' ? appointments.length : appointments.filter(a => a.status === key).length;
    return acc;
  }, {});

  return (
    <div className="appt-page">
      <div className="container">
        <div className="appt-header">
          <div>
            <h1 className="appt-title">Lich hen xem phong</h1>
            <p className="appt-sub">{isLandlord ? 'Quan ly lich hen cua tenant' : 'Cac lich hen ban da dat'}</p>
          </div>
          {!isLandlord && <Link to="/rooms" className="btn btn-primary">Tim phong</Link>}
        </div>

        <div className="appt-tabs">
          {FILTERS.map(key => (
            <button key={key} className={`appt-tab ${filter === key ? 'appt-tab--active' : ''}`} onClick={() => setFilter(key)}>
              {key === 'all' ? 'Tat ca' : STATUS_MAP[key].label}
              <span className="appt-tab-count">{counts[key] || 0}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <p className="appt-muted">Dang tai...</p>
        ) : filtered.length === 0 ? (
          <div className="appt-empty">
            <h3>Chua co lich hen</h3>
            <p>{filter === 'all' ? 'Chua co du lieu lich hen.' : `Khong co lich o trang thai ${STATUS_MAP[filter]?.label}.`}</p>
          </div>
        ) : (
          <div className="appt-list">
            {filtered.map(appt => {
              const status = STATUS_MAP[appt.status] || STATUS_MAP.pending;
              const active = ['pending', 'confirmed'].includes(appt.status);
              const busy = actionId === appt.id;

              return (
                <div key={appt.id} className={`appt-card appt-card--${appt.status}`}>
                  <div className="appt-card__body">
                    <div className="appt-card__row">
                      <span className={`badge ${status.cls}`}>{status.label}</span>
                      <span className="appt-time">{new Date(appt.scheduled_at).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    </div>
                    <Link to={`/rooms/${appt.room_id}`} className="appt-room-link">
                      {appt.room?.title || `Phong #${appt.room_id?.slice(0, 8)}`}
                    </Link>
                    <p className="appt-meta">
                      {isLandlord
                        ? `Tenant: ${appt.tenant?.full_name || appt.tenant_id?.slice(0, 8)}`
                        : `Landlord: ${appt.landlord?.full_name || appt.landlord_id?.slice(0, 8)}`}
                      <span className="appt-create"> · Dat lich {formatDate(appt.created_at)}</span>
                    </p>
                    {appt.cancellation_reason && <p className="appt-meta">Ly do huy: {appt.cancellation_reason}</p>}
                  </div>

                  {active && (
                    <div className="appt-actions">
                      {isLandlord && appt.status === 'pending' && (
                        <button className="btn btn-sm" disabled={busy} onClick={() => updateStatus(appt, 'confirmed')}>Xac nhan</button>
                      )}
                      {isLandlord && appt.status === 'confirmed' && (
                        <>
                          <button className="btn btn-sm" disabled={busy} onClick={() => updateStatus(appt, 'completed')}>Hoan thanh</button>
                          <button className="btn btn-sm" disabled={busy} onClick={() => updateStatus(appt, 'no_show')}>Khong den</button>
                        </>
                      )}
                      <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => reschedule(appt)}>Doi lich</button>
                      <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => updateStatus(appt, 'cancelled')}>
                        {isLandlord && appt.status === 'pending' ? 'Tu choi' : 'Huy lich'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        .appt-page { padding: 32px 0 80px; }
        .appt-header { display:flex; align-items:flex-start; justify-content:space-between; flex-wrap:wrap; gap:16px; margin-bottom:24px; }
        .appt-title { font-size:26px; font-weight:800; color:var(--text-primary); margin-bottom:4px; }
        .appt-sub, .appt-muted { font-size:14px; color:var(--text-secondary); }
        .appt-tabs { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:24px; }
        .appt-tab { display:flex; align-items:center; gap:8px; padding:8px 14px; border-radius:var(--radius-full); border:1px solid var(--border); background:transparent; color:var(--text-secondary); font-size:13px; font-weight:600; cursor:pointer; }
        .appt-tab--active { background:var(--primary); border-color:var(--primary); color:#fff; }
        .appt-tab-count { background:var(--bg-hover); padding:1px 7px; border-radius:var(--radius-full); font-size:11px; font-weight:700; }
        .appt-tab--active .appt-tab-count { background:rgba(255,255,255,.2); }
        .appt-list { display:flex; flex-direction:column; gap:12px; }
        .appt-card { display:flex; align-items:flex-start; gap:16px; background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-lg); padding:18px 20px; }
        .appt-card--completed, .appt-card--confirmed { border-left:3px solid var(--success); }
        .appt-card--cancelled, .appt-card--no_show { border-left:3px solid var(--danger); opacity:.8; }
        .appt-card--pending { border-left:3px solid var(--accent); }
        .appt-card__body { flex:1; display:flex; flex-direction:column; gap:6px; min-width:0; }
        .appt-card__row { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
        .appt-time, .appt-meta { font-size:13px; color:var(--text-secondary); }
        .appt-room-link { font-size:14px; font-weight:700; color:var(--primary); }
        .appt-create { color:var(--text-muted); }
        .appt-actions { display:flex; flex-wrap:wrap; gap:8px; flex-shrink:0; justify-content:flex-end; }
        .appt-empty { padding:56px 24px; text-align:center; background:var(--bg-card); border:1px dashed var(--border); border-radius:var(--radius-lg); color:var(--text-secondary); }
        @media(max-width:700px){ .appt-card { flex-direction:column; } .appt-actions { justify-content:flex-start; } }
      `}</style>
    </div>
  );
};

export default AppointmentsPage;
