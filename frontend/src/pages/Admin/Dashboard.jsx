import { useState, useEffect } from 'react';
import { Link, Routes, Route, NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import apiClient from '../../api/apiClient';
import PendingRooms from './PendingRooms';
import AdminAllRooms from './AllRooms';
import AdminUsers from './Users';
import AdminReports from './Reports';

const AdminDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [activityLogs, setActivityLogs] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await apiClient.get('/admin/stats');
        setStats(data);
        const logs = await apiClient.get('/admin/activity-logs');
        setActivityLogs(logs.data || []);
      } catch (e) { console.error(e); }
      finally { setStatsLoading(false); }
    };
    load();
  }, []);

  return (
    <div className="admin-layout">
      {/* ── Sidebar ── */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar__brand">🛡️ Admin</div>
        <nav className="admin-nav">
          {[
            { to: '/admin/dashboard', icon: '📊', label: 'Tổng quan' },
            { to: '/admin/rooms',     icon: '🏠', label: 'Tất cả phòng' },
            { to: '/admin/pending',   icon: '⏳', label: 'Duyệt phòng' },
            { to: '/admin/users',     icon: '👥', label: 'Người dùng' },
            { to: '/admin/reports',   icon: '🚨', label: 'Báo cáo' },
          ].map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              id={`admin-nav-${label.replace(/\s/g, '-').toLowerCase()}`}
              className={({ isActive }) => `admin-nav__item ${isActive ? 'admin-nav__item--active' : ''}`}
            >
              <span>{icon}</span> {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* ── Main ── */}
      <main className="admin-main">
        <div className="admin-topbar animate-slideUp">
          <div>
            <h1 className="admin-topbar__title">🛡️ Admin Dashboard</h1>
            <p className="admin-topbar__sub">Xin chào, <strong>{user?.full_name}</strong>!</p>
          </div>
          <Link to="/" className="btn btn-ghost btn-sm">← Về trang chủ</Link>
        </div>

        {/* Stats Summary */}
        <div className="admin-stats animate-fadeIn">
          {[
            { icon: '👥', label: 'Người dùng', key: 'totalUsers', color: '#0d9488' },
            { icon: '🏠', label: 'Tổng phòng', key: 'totalRooms', color: '#3b82f6', link: '/admin/rooms' },
            { icon: '⏳', label: 'Chờ duyệt',  key: 'pendingRooms', color: '#f59e0b', link: '/admin/pending' },
            { icon: '✅', label: 'Đã duyệt',  key: 'approvedRooms', color: '#10b981' },
            { icon: '🚨', label: 'Báo cáo',    key: 'pendingReports', color: '#ef4444' },
            { icon: '🆕', label: 'User mới tháng', key: 'newUsersThisMonth', color: '#8b5cf6' },
          ].map(({ icon, label, key, color, link }) => (
            link ? (
              <Link to={link} key={key} className="admin-stat-card" style={{ '--c': color }}>
                <span className="admin-stat-icon">{icon}</span>
                <div>
                  <strong className="admin-stat-value">
                    {statsLoading ? '…' : (stats?.[key] ?? '—')}
                  </strong>
                  <p className="admin-stat-label">{label}</p>
                </div>
              </Link>
            ) : (
              <div key={key} className="admin-stat-card" style={{ '--c': color }}>
                <span className="admin-stat-icon">{icon}</span>
                <div>
                  <strong className="admin-stat-value">
                    {statsLoading ? '…' : (stats?.[key] ?? '—')}
                  </strong>
                  <p className="admin-stat-label">{label}</p>
                </div>
              </div>
            )
          ))}
        </div>

        <div className="admin-ops-stats animate-fadeIn">
          {[
            ['Moi gioi', stats?.totalBrokers],
            ['Phong da gan moi gioi', stats?.brokerAssignedRooms],
            ['Phong con cho', stats?.availableRooms],
            ['Phong het cho', stats?.fullRooms],
            ['Yeu cau thanh cong', stats?.acceptedRequests],
          ].map(([label, value]) => (
            <div className="admin-ops-stat" key={label}>
              <strong>{statsLoading ? '-' : (value ?? 0)}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>

        {/* Sub-pages via nested routing */}
        <div className="admin-content animate-fadeIn">
          <Routes>
            <Route index path="dashboard" element={<AdminOverview stats={stats} loading={statsLoading} activityLogs={activityLogs} />} />
            <Route path="rooms"           element={<AdminAllRooms />} />
            <Route path="pending"         element={<PendingRooms />} />
            <Route path="users"           element={<AdminUsers />} />
            <Route path="reports"         element={<AdminReports />} />
            <Route path="*"               element={<AdminOverview stats={stats} loading={statsLoading} activityLogs={activityLogs} />} />
          </Routes>
        </div>
      </main>

      <style>{styles}</style>
    </div>
  );
};

const AdminOverview = ({ stats, loading, activityLogs = [] }) => (
  <div>
    <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
      Tổng quan hệ thống
    </h2>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
      {[
        { label: 'Phòng đã duyệt', value: stats?.approvedRooms, color: 'var(--success)', icon: '✅' },
        { label: 'Phòng chờ duyệt', value: stats?.pendingRooms, color: 'var(--warning)', icon: '⏳' },
        { label: 'Phòng bị từ chối', value: stats?.rejectedRooms, color: 'var(--danger)', icon: '❌' },
        { label: 'Reports chờ xử lý', value: stats?.pendingReports, color: 'var(--info)', icon: '🚨' },
      ].map(({ label, value, color, icon }) => (
        <div key={label} style={{
          background: 'var(--bg-warm)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', padding: '16px',
          display: 'flex', flexDirection: 'column', gap: 4
        }}>
          <span style={{ fontSize: 24 }}>{icon}</span>
          <strong style={{ fontSize: 22, color, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
            {loading ? '…' : (value ?? 0)}
          </strong>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</p>
        </div>
      ))}
    </div>
    <div style={{
      marginTop: 20, padding: 16, background: 'var(--bg-warm)',
      border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
      color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.8,
    }}>
      <p>Sử dụng sidebar bên trái để:</p>
      <ul style={{ paddingLeft: 20, marginTop: 8 }}>
        <li><strong>Duyệt phòng</strong> — Xem và duyệt/từ chối các phòng đang chờ</li>
        <li><strong>Người dùng</strong> — Xem danh sách và đổi role người dùng</li>
      </ul>
    </div>
    <div style={{
      marginTop: 20, padding: 16, background: 'var(--bg-warm)',
      border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
    }}>
      <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10 }}>Lich su xu ly gan day</h3>
      {activityLogs.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Chua co hoat dong nao.</p>
      ) : activityLogs.slice(0, 8).map(log => (
        <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderTop: '1px solid var(--border)' }}>
          <span style={{ color: 'var(--text-primary)', fontSize: 13 }}>{log.action}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{log.actor?.full_name || 'He thong'} - {new Date(log.created_at).toLocaleString('vi-VN')}</span>
        </div>
      ))}
    </div>
  </div>
);

const styles = `
  .admin-layout {
    display: flex; min-height: calc(100vh - 72px);
  }

  /* Sidebar */
  .admin-sidebar {
    width: 220px; flex-shrink: 0;
    background: var(--bg-card); border-right: 1px solid var(--border);
    padding: 24px 14px; display: flex; flex-direction: column; gap: 20px;
    position: sticky; top: 72px; height: calc(100vh - 72px);
  }
  .admin-sidebar__brand { font-size: 15px; font-weight: 800; color: var(--text-primary); padding: 0 10px; letter-spacing: -0.01em; }
  .admin-nav { display: flex; flex-direction: column; gap: 2px; }
  .admin-nav__item {
    display: flex; align-items: center; gap: 8px;
    padding: 9px 12px; border-radius: var(--radius-md);
    font-size: 13.5px; font-weight: 500; color: var(--text-secondary);
    transition: var(--transition);
  }
  .admin-nav__item:hover { background: var(--bg-hover); color: var(--text-primary); }
  .admin-nav__item--active { background: var(--primary-50); color: var(--primary-dark); font-weight: 600; }

  /* Main */
  .admin-main { flex: 1; padding: 24px 28px; overflow-x: hidden; }
  .admin-topbar { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; gap: 12px; }
  .admin-topbar__title { font-size: 22px; font-weight: 800; color: var(--text-primary); margin-bottom: 4px; }
  .admin-topbar__sub { color: var(--text-secondary); font-size: 13px; }

  /* Stats row */
  .admin-stats { display: grid; grid-template-columns: repeat(6, 1fr); gap: 14px; margin-bottom: 24px; }
  @media(max-width:1100px){ .admin-stats { grid-template-columns: repeat(3,1fr); } }
  @media(max-width:700px){ .admin-stats { grid-template-columns: repeat(2,1fr); } }

  .admin-stat-card {
    display: flex; align-items: center; gap: 14px; padding: 18px;
    background: var(--bg-card); border: 1px solid var(--border);
    border-radius: var(--radius-lg); transition: var(--transition);
  }
  .admin-stat-card:hover { border-color: var(--border-hover); box-shadow: var(--shadow-sm); }
  .admin-stat-icon { font-size: 24px; }
  .admin-stat-value { display: block; font-size: 22px; font-weight: 800; color: var(--c, var(--text-primary)); font-variant-numeric: tabular-nums; }
  .admin-stat-label { font-size: 12px; color: var(--text-muted); margin-top: 2px; font-weight: 500; }

  .admin-content {
    background: var(--bg-card); border: 1px solid var(--border);
    border-radius: var(--radius-lg); padding: 24px;
  }
  .admin-ops-stats {
    display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin: -8px 0 24px;
  }
  .admin-ops-stat {
    background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md);
    padding: 12px 14px;
  }
  .admin-ops-stat strong { display:block; color: var(--text-primary); font-size: 20px; font-weight: 800; }
  .admin-ops-stat span { color: var(--text-muted); font-size: 12px; }
  @media(max-width:900px){ .admin-ops-stats { grid-template-columns: repeat(2,1fr); } }

  @media(max-width:768px){
    .admin-layout { flex-direction: column; }
    .admin-sidebar { width: 100%; height: auto; position: static; flex-direction: row; align-items: center; padding: 12px; overflow-x: auto; gap: 8px; }
    .admin-nav { flex-direction: row; gap: 4px; }
    .admin-main { padding: 16px; }
  }
`;

export default AdminDashboard;
