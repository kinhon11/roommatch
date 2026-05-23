import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { appointmentService } from '../../services/appointmentService';
import { formatDate } from '../../utils/format';
import { useDialog } from '../../context/DialogContext';
import { useToast } from '../../context/ToastContext';

const STATUS_MAP = {
  pending: { label: 'Chờ xác nhận', cls: 'badge-pending' },
  confirmed: { label: 'Đã xác nhận', cls: 'badge-approved' },
  completed: { label: 'Hoàn thành', cls: 'badge-approved' },
  cancelled: { label: 'Đã hủy', cls: 'badge-rejected' },
  no_show: { label: 'Không đến', cls: 'badge-rejected' },
};

const FILTERS = ['all', 'pending', 'confirmed', 'completed', 'cancelled', 'no_show'];

const AppointmentsPage = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const [filter, setFilter] = useState('all');
  const isManager = user?.role === 'landlord' || user?.role === 'broker';
  const dialog = useDialog();
  const toast = useToast();

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
      reason = await dialog.prompt({
        title: isManager && appointment.status === 'pending' ? 'Từ chối lịch hẹn' : 'Hủy lịch hẹn',
        label: 'Lý do',
        placeholder: 'Nhập lý do để người còn lại nắm được thông tin...',
        confirmText: isManager && appointment.status === 'pending' ? 'Từ chối' : 'Hủy lịch',
        tone: 'danger',
      });
      if (!reason?.trim()) return;
    }

    setActionId(appointment.id);
    try {
      await appointmentService.updateStatus(appointment.id, status, reason?.trim());
      await load();
      toast.success('Cập nhật lịch hẹn thành công.');
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Cập nhật lịch hẹn thất bại.');
    } finally {
      setActionId(null);
    }
  };

  const reschedule = async (appointment) => {
    const input = await dialog.prompt({
      title: 'Đổi lịch hẹn',
      label: 'Thời gian mới',
      placeholder: 'YYYY-MM-DDTHH:mm',
      defaultValue: appointment.scheduled_at?.slice(0, 16),
      inputType: 'datetime-local',
      confirmText: 'Đổi lịch',
    });
    if (!input) return;
    const nextDate = new Date(input);
    if (Number.isNaN(nextDate.getTime())) {
      toast.warning('Thời gian mới không hợp lệ.');
      return;
    }

    setActionId(appointment.id);
    try {
      await appointmentService.reschedule(appointment.id, nextDate.toISOString());
      await load();
      toast.success('Đã đổi lịch hẹn.');
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Đổi lịch hẹn thất bại.');
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
            <h1 className="appt-title">Lịch hẹn xem phòng</h1>
            <p className="appt-sub">{isManager ? 'Quản lý lịch hẹn của tenant' : 'Các lịch hẹn bạn đã đặt'}</p>
          </div>
          {!isManager && <Link to="/rooms" className="btn btn-primary">Tìm phòng</Link>}
        </div>

        <div className="appt-tabs">
          {FILTERS.map(key => (
            <button key={key} className={`appt-tab ${filter === key ? 'appt-tab--active' : ''}`} onClick={() => setFilter(key)}>
              {key === 'all' ? 'Tất cả' : STATUS_MAP[key].label}
              <span className="appt-tab-count">{counts[key] || 0}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <p className="appt-muted">Đang tải...</p>
        ) : filtered.length === 0 ? (
          <div className="appt-empty">
            <h3>Chưa có lịch hẹn</h3>
            <p>{filter === 'all' ? 'Chưa có dữ liệu lịch hẹn.' : `Không có lịch ở trạng thái ${STATUS_MAP[filter]?.label}.`}</p>
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
                      {appt.room?.title || `Phòng #${appt.room_id?.slice(0, 8)}`}
                    </Link>
                    <p className="appt-meta">
                      {isManager
                        ? `Tenant: ${appt.tenant?.full_name || appt.tenant_id?.slice(0, 8)}`
                        : `Landlord: ${appt.landlord?.full_name || appt.landlord_id?.slice(0, 8)}`}
                      <span className="appt-create"> · Đặt lịch {formatDate(appt.created_at)}</span>
                    </p>
                    {appt.cancellation_reason && <p className="appt-meta">Lý do hủy: {appt.cancellation_reason}</p>}
                  </div>

                  {active && (
                    <div className="appt-actions">
                      {isManager && appt.status === 'pending' && (
                        <button className="btn btn-sm" disabled={busy} onClick={() => updateStatus(appt, 'confirmed')}>Xác nhận</button>
                      )}
                      {isManager && appt.status === 'confirmed' && (
                        <>
                          <button className="btn btn-sm" disabled={busy} onClick={() => updateStatus(appt, 'completed')}>Hoàn thành</button>
                          <button className="btn btn-sm" disabled={busy} onClick={() => updateStatus(appt, 'no_show')}>Không đến</button>
                        </>
                      )}
                      <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => reschedule(appt)}>Đổi lịch</button>
                      <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => updateStatus(appt, 'cancelled')}>
                        {isManager && appt.status === 'pending' ? 'Từ chối' : 'Hủy lịch'}
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
        .appt-card--completed, .appt-card--confirmed { border-color:rgba(16,185,129,.28); background:rgba(16,185,129,.04); }
        .appt-card--cancelled, .appt-card--no_show { border-color:rgba(239,68,68,.24); background:rgba(239,68,68,.035); opacity:.88; }
        .appt-card--pending { border-color:rgba(245,158,11,.3); background:rgba(245,158,11,.04); }
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
