import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../api/apiClient';
import { useAuth } from '../../hooks/useAuth';
import { formatDate } from '../../utils/format';

const BrokerDashboard = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/admin/broker-dashboard')
      .then(res => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const stats = data?.stats || {};
  const statItems = [
    ['Phòng được giao', stats.assignedRooms || 0],
    ['Đang còn chỗ', stats.availableRooms || 0],
    ['Lead đang chăm sóc', stats.activeLeads || 0],
    ['Hết chỗ', stats.fullRooms || 0],
    ['Yêu cầu chờ xử lý', stats.pendingRequests || 0],
    ['Lịch hẹn sắp tới', stats.upcomingAppointments || 0],
  ];

  return (
    <div className="broker-page">
      <div className="container">
        <header className="broker-head">
          <div>
            <h1>Dashboard môi giới</h1>
            <p>Xin chào {user?.full_name}. Theo dõi phòng được phân công và việc cần xử lý.</p>
          </div>
          <div className="broker-actions">
            <Link to="/landlord/my-rooms" className="btn btn-primary">Phòng được giao</Link>
            <Link to="/broker/leads" className="btn btn-secondary">Quản lý lead</Link>
            <Link to="/landlord/requests" className="btn btn-secondary">Yêu cầu ở ghép</Link>
          </div>
        </header>

        <section className="broker-stats">
          {statItems.map(([label, value]) => (
            <div className="broker-stat" key={label}>
              <strong>{loading ? '-' : value}</strong>
              <span>{label}</span>
            </div>
          ))}
        </section>

        <section className="broker-grid">
          <div className="broker-panel">
            <h2>Lead cần chăm sóc</h2>
            {loading ? <p>Đang tải...</p> : data?.leads?.length ? (
              data.leads.slice(0, 6).map(lead => (
                <Link to="/broker/leads" className="broker-row" key={lead.id}>
                  <span>{lead.full_name} - {lead.status}</span>
                  <small>{lead.phone}{lead.preferred_area ? `, ${lead.preferred_area}` : ''}</small>
                </Link>
              ))
            ) : <p>Chưa có lead.</p>}
          </div>

          <div className="broker-panel">
            <h2>Phòng phụ trách</h2>
            {loading ? <p>Đang tải...</p> : data?.rooms?.length ? (
              data.rooms.slice(0, 6).map(room => (
                <Link to={`/rooms/${room.id}`} className="broker-row" key={room.id}>
                  <span>{room.title}</span>
                  <small>{room.available_slots ?? 0} chỗ, {room.status}</small>
                </Link>
              ))
            ) : <p>Chưa có phòng được phân công.</p>}
          </div>

          <div className="broker-panel">
            <h2>Yêu cầu mới</h2>
            {loading ? <p>Đang tải...</p> : data?.requests?.length ? (
              data.requests.slice(0, 6).map(req => (
                <div className="broker-row" key={req.id}>
                  <span>{req.tenant?.full_name || 'Tenant'} - {req.status}</span>
                  <small>{req.occupants || 1} người, {formatDate(req.created_at)}</small>
                </div>
              ))
            ) : <p>Không có yêu cầu mới.</p>}
          </div>

          <div className="broker-panel">
            <h2>Lịch hẹn</h2>
            {loading ? <p>Đang tải...</p> : data?.appointments?.length ? (
              data.appointments.slice(0, 6).map(appt => (
                <div className="broker-row" key={appt.id}>
                  <span>{appt.room?.title || 'Phòng'} - {appt.status}</span>
                  <small>{new Date(appt.scheduled_at).toLocaleString('vi-VN')}</small>
                </div>
              ))
            ) : <p>Chưa có lịch hẹn.</p>}
          </div>

          <div className="broker-panel">
            <h2>Lịch sử xử lý</h2>
            {loading ? <p>Đang tải...</p> : data?.activities?.length ? (
              data.activities.map(item => (
                <div className="broker-row" key={item.id}>
                  <span>{item.action}</span>
                  <small>{formatDate(item.created_at)}</small>
                </div>
              ))
            ) : <p>Chưa có hoạt động nào.</p>}
          </div>
        </section>
      </div>

      <style>{`
        .broker-page { padding: 32px 0 80px; }
        .broker-head { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:24px; }
        .broker-head h1 { font-size:26px; font-weight:800; color:var(--text-primary); }
        .broker-head p { color:var(--text-secondary); margin-top:4px; }
        .broker-actions { display:flex; gap:10px; flex-wrap:wrap; }
        .broker-stats { display:grid; grid-template-columns:repeat(6,1fr); gap:12px; margin-bottom:24px; }
        .broker-stat { background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-lg); padding:16px; }
        .broker-stat strong { display:block; font-size:24px; color:var(--primary); font-weight:800; }
        .broker-stat span { font-size:12px; color:var(--text-muted); }
        .broker-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:16px; }
        .broker-panel { background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-lg); padding:18px; }
        .broker-panel h2 { font-size:16px; font-weight:800; color:var(--text-primary); margin-bottom:12px; }
        .broker-row { display:flex; justify-content:space-between; gap:12px; padding:10px 0; border-bottom:1px solid var(--border); color:var(--text-primary); }
        .broker-row:last-child { border-bottom:0; }
        .broker-row span { font-size:13px; font-weight:600; }
        .broker-row small { font-size:12px; color:var(--text-muted); text-align:right; }
        @media(max-width:900px){ .broker-stats,.broker-grid{grid-template-columns:1fr 1fr;} }
        @media(max-width:640px){ .broker-head{display:block;} .broker-actions{margin-top:14px;} .broker-stats,.broker-grid{grid-template-columns:1fr;} }
      `}</style>
    </div>
  );
};

export default BrokerDashboard;
