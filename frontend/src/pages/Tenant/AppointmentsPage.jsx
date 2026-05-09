import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { appointmentService } from '../../services/appointmentService';
import { formatDate } from '../../utils/format';

const STATUS_MAP = {
  scheduled:  { label: 'Đã lên lịch', cls: 'badge-pending',  icon: '📅' },
  completed:  { label: 'Hoàn thành',  cls: 'badge-approved', icon: '✅' },
  cancelled:  { label: 'Đã hủy',      cls: 'badge-rejected', icon: '❌' },
};

const AppointmentsPage = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [actionId, setActionId]         = useState(null);
  const [filter, setFilter]             = useState('all'); // all | scheduled | completed | cancelled

  const isLandlord = user?.role === 'landlord';

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await appointmentService.list();
      setAppointments(Array.isArray(data) ? data : []);
    } catch { setAppointments([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleStatus = async (id, status) => {
    setActionId(id);
    try {
      await appointmentService.updateStatus(id, status);
      setAppointments(prev =>
        prev.map(a => a.id === id ? { ...a, status } : a)
      );
    } catch (err) {
      alert('Lỗi: ' + (err.response?.data?.error || err.message));
    } finally { setActionId(null); }
  };

  const filtered = filter === 'all'
    ? appointments
    : appointments.filter(a => a.status === filter);

  const counts = {
    all:       appointments.length,
    scheduled: appointments.filter(a => a.status === 'scheduled').length,
    completed: appointments.filter(a => a.status === 'completed').length,
    cancelled: appointments.filter(a => a.status === 'cancelled').length,
  };

  return (
    <div className="appt-page">
      <div className="container">
        {/* Header */}
        <div className="appt-header animate-slideUp">
          <div>
            <h1 className="appt-title">📅 Lịch hẹn xem phòng</h1>
            <p className="appt-sub">
              {isLandlord
                ? 'Quản lý các lịch hẹn từ người thuê phòng của bạn'
                : 'Các lịch hẹn xem phòng bạn đã đặt'}
            </p>
          </div>
          {!isLandlord && (
            <Link to="/rooms" className="btn btn-primary">🔍 Tìm phòng để đặt lịch</Link>
          )}
        </div>

        {/* Filter tabs */}
        <div className="appt-tabs animate-slideUp">
          {[
            { key: 'all',       label: 'Tất cả' },
            { key: 'scheduled', label: 'Đã lên lịch' },
            { key: 'completed', label: 'Hoàn thành' },
            { key: 'cancelled', label: 'Đã hủy' },
          ].map(t => (
            <button
              key={t.key}
              id={`appt-tab-${t.key}`}
              className={`appt-tab ${filter === t.key ? 'appt-tab--active' : ''}`}
              onClick={() => setFilter(t.key)}
            >
              {t.label}
              <span className="appt-tab-count">{counts[t.key]}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="appt-skeleton-list">
            {[1,2,3].map(i => <div key={i} className="appt-skeleton" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="appt-empty">
            <span>📭</span>
            <h3>Chưa có lịch hẹn nào</h3>
            <p>{filter === 'all' ? 'Đặt lịch xem phòng ngay hôm nay!' : `Không có lịch hẹn ở trạng thái "${STATUS_MAP[filter]?.label || filter}"`}</p>
            {!isLandlord && <Link to="/rooms" className="btn btn-primary" style={{marginTop:12}}>Tìm phòng</Link>}
          </div>
        ) : (
          <div className="appt-list animate-fadeIn">
            {filtered.map(appt => {
              const s = STATUS_MAP[appt.status] || STATUS_MAP.scheduled;
              const isLoading = actionId === appt.id;
              return (
                <div key={appt.id} className={`appt-card appt-card--${appt.status}`}>
                  <div className="appt-card__icon">{s.icon}</div>
                  <div className="appt-card__body">
                    <div className="appt-card__row">
                      <span className={`badge ${s.cls}`}>{s.label}</span>
                      <span className="appt-time">
                        🕐 {new Date(appt.scheduled_at).toLocaleString('vi-VN', {
                          dateStyle: 'medium', timeStyle: 'short'
                        })}
                      </span>
                    </div>
                    {appt.room && (
                      <Link to={`/rooms/${appt.room_id}`} className="appt-room-link">
                        🏠 {appt.room?.title || `Phòng #${appt.room_id?.slice(0,8)}`}
                      </Link>
                    )}
                    {!appt.room && (
                      <p className="appt-room-link">🏠 Phòng #{appt.room_id?.slice(0,8)}</p>
                    )}
                    <p className="appt-meta">
                      {isLandlord
                        ? `👤 Người thuê: ${appt.tenant?.full_name || appt.tenant_id?.slice(0,8)}`
                        : `🏠 Chủ nhà: ${appt.landlord?.full_name || appt.landlord_id?.slice(0,8)}`
                      }
                      <span className="appt-create">· Đặt lịch {formatDate(appt.created_at)}</span>
                    </p>
                  </div>

                  {/* Actions for landlord on scheduled appointments */}
                  {isLandlord && appt.status === 'scheduled' && (
                    <div className="appt-actions">
                      <button
                        id={`btn-complete-${appt.id}`}
                        className="btn btn-sm"
                        style={{ background:'rgba(16,185,129,.15)', color:'var(--success)', border:'1px solid rgba(16,185,129,.3)' }}
                        onClick={() => handleStatus(appt.id, 'completed')}
                        disabled={isLoading}
                      >
                        {isLoading ? '...' : '✅ Hoàn thành'}
                      </button>
                      <button
                        id={`btn-cancel-${appt.id}`}
                        className="btn btn-danger btn-sm"
                        onClick={() => handleStatus(appt.id, 'cancelled')}
                        disabled={isLoading}
                      >
                        {isLoading ? '...' : '❌ Hủy lịch'}
                      </button>
                    </div>
                  )}
                  {/* Tenant can cancel scheduled */}
                  {!isLandlord && appt.status === 'scheduled' && (
                    <div className="appt-actions">
                      <button
                        id={`btn-tenant-cancel-${appt.id}`}
                        className="btn btn-danger btn-sm"
                        onClick={() => handleStatus(appt.id, 'cancelled')}
                        disabled={isLoading}
                      >
                        {isLoading ? '...' : '❌ Hủy lịch'}
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
        .appt-sub { font-size:14px; color:var(--text-secondary); }

        /* Tabs */
        .appt-tabs { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:24px; }
        .appt-tab {
          display:flex; align-items:center; gap:8px;
          padding:8px 16px; border-radius:var(--radius-full);
          border:1px solid var(--border); background:transparent;
          color:var(--text-secondary); font-size:13px; font-weight:500;
          cursor:pointer; transition:var(--transition); font-family:inherit;
        }
        .appt-tab:hover { border-color:var(--border-hover); color:var(--text-primary); }
        .appt-tab--active { background:var(--primary); border-color:var(--primary); color:#fff; font-weight:600; }
        .appt-tab-count { background:rgba(255,255,255,.2); padding:1px 7px; border-radius:var(--radius-full); font-size:11px; font-weight:700; }
        .appt-tab:not(.appt-tab--active) .appt-tab-count { background:var(--bg-hover); }

        /* List */
        .appt-list { display:flex; flex-direction:column; gap:12px; }
        .appt-card {
          display:flex; align-items:flex-start; gap:16px;
          background:var(--bg-card); border:1px solid var(--border);
          border-radius:var(--radius-lg); padding:18px 20px;
          transition:var(--transition);
        }
        .appt-card:hover { border-color:var(--border-hover); box-shadow:var(--shadow-sm); }
        .appt-card--completed { border-left:3px solid var(--success); }
        .appt-card--cancelled { border-left:3px solid var(--danger); opacity:.7; }
        .appt-card--scheduled { border-left:3px solid var(--accent); }

        .appt-card__icon { font-size:28px; flex-shrink:0; }
        .appt-card__body { flex:1; display:flex; flex-direction:column; gap:6px; }
        .appt-card__row { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
        .appt-time { font-size:13px; color:var(--text-secondary); font-weight:500; }
        .appt-room-link { font-size:14px; font-weight:600; color:var(--primary); }
        .appt-room-link:hover { text-decoration:underline; }
        .appt-meta { font-size:13px; color:var(--text-secondary); }
        .appt-create { color:var(--text-muted); margin-left:4px; }

        .appt-actions { display:flex; flex-direction:column; gap:8px; flex-shrink:0; }
        @media(max-width:640px){ .appt-card { flex-direction:column; } .appt-actions { flex-direction:row; } }

        /* Empty */
        .appt-empty {
          display:flex; flex-direction:column; align-items:center; justify-content:center;
          gap:12px; padding:80px 24px; text-align:center;
          background:var(--bg-card); border:1px dashed var(--border); border-radius:var(--radius-xl);
        }
        .appt-empty span { font-size:48px; }
        .appt-empty h3 { font-size:20px; font-weight:700; color:var(--text-primary); }
        .appt-empty p { color:var(--text-secondary); font-size:14px; }

        /* Skeleton */
        .appt-skeleton-list { display:flex; flex-direction:column; gap:12px; }
        .appt-skeleton {
          height:90px; border-radius:var(--radius-lg);
          background:linear-gradient(90deg,var(--bg-hover) 25%,var(--border) 50%,var(--bg-hover) 75%);
          background-size:200% 100%; animation:shimmer 1.5s infinite;
        }
      `}</style>
    </div>
  );
};

export default AppointmentsPage;
