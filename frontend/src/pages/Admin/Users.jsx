import { useState, useEffect } from 'react';
import apiClient from '../../api/apiClient';
import { useToast } from '../../context/ToastContext';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState({});
  const [search, setSearch] = useState('');
  const toast = useToast();

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await apiClient.get('/admin/users');
        setUsers(data || []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetch();
  }, []);

  const handleRoleChange = async (userId, newRole) => {
    setUpdating(s => ({ ...s, [userId]: true }));
    try {
      await apiClient.patch(`/admin/users/${userId}/role`, { role: newRole });
      setUsers(u => u.map(usr => usr.id === userId ? { ...usr, role: newRole } : usr));
      toast.success('Cập nhật vai trò thành công.');
    } catch (e) {
      toast.error(e.response?.data?.error || e.message || 'Cập nhật vai trò thất bại.');
    } finally {
      setUpdating(s => ({ ...s, [userId]: false }));
    }
  };

  const handleToggleLock = async (userId) => {
    setUpdating(s => ({ ...s, [userId]: true }));
    try {
      const { data } = await apiClient.patch(`/admin/users/${userId}/lock`);
      setUsers(u => u.map(usr => usr.id === userId ? { ...usr, is_locked: data.user?.is_locked ?? !usr.is_locked } : usr));
      toast.success(data.user?.is_locked ? 'Đã khóa tài khoản.' : 'Đã mở khóa tài khoản.');
    } catch (e) {
      toast.error(e.response?.data?.error || e.message || 'Cập nhật trạng thái tài khoản thất bại.');
    } finally {
      setUpdating(s => ({ ...s, [userId]: false }));
    }
  };

  const filtered = users.filter(u =>
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const ROLES = ['tenant', 'landlord', 'admin'];

  return (
    <div className="admin-users-page">
      <div className="users-header">
        <h2>👥 Quản lý người dùng</h2>
        <span className="badge badge-admin">{users.length} tài khoản</span>
      </div>

      <div className="users-search">
        <input
          id="users-search-input"
          className="form-input"
          type="text"
          placeholder="🔍 Tìm theo tên hoặc email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="users-loading">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="user-skeleton" />)}
        </div>
      ) : (
        <div className="users-table-wrap">
          <table className="users-table">
            <thead>
              <tr>
                <th>Người dùng</th>
                <th>Email</th>
                <th>SĐT</th>
                <th>Ngày tạo</th>
                <th>Role</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id}>
                  <td>
                    <div className="user-cell">
                      {u.avatar_url
                        ? <img src={u.avatar_url} alt="" className="user-avatar" />
                        : <div className="user-avatar user-avatar--fallback">{(u.full_name || 'U')[0]}</div>
                      }
                      <span className="user-name">{u.full_name}</span>
                    </div>
                  </td>
                  <td className="user-email">{u.email}</td>
                  <td className="user-phone">{u.phone || '—'}</td>
                  <td className="user-date">{u.created_at ? new Date(u.created_at).toLocaleDateString('vi-VN') : '—'}</td>
                  <td>
                    <select
                      id={`role-select-${u.id}`}
                      className={`role-select role-select--${u.role}`}
                      value={u.role}
                      disabled={updating[u.id]}
                      onChange={e => handleRoleChange(u.id, e.target.value)}
                    >
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td>
                    <button
                      className={`btn btn-sm ${u.is_locked ? 'btn-danger' : ''}`}
                      style={!u.is_locked ? { background: 'rgba(16,185,129,.1)', color: 'var(--success)', border: '1px solid rgba(16,185,129,.3)' } : {}}
                      disabled={updating[u.id]}
                      onClick={() => handleToggleLock(u.id)}
                    >
                      {u.is_locked ? '🔒 Đã khóa' : '🔓 Hoạt động'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="users-empty">Không tìm thấy người dùng nào.</div>
          )}
        </div>
      )}

      <style>{styles}</style>
    </div>
  );
};

const styles = `
  .admin-users-page { padding: 20px 0; }
  .users-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
  .users-header h2 { font-size: 22px; font-weight: 800; color: var(--text-primary); }
  .users-search { margin-bottom: 20px; max-width: 400px; }

  .users-table-wrap { overflow-x: auto; border-radius: var(--radius-lg); border: 1px solid var(--border); }
  .users-table { width: 100%; border-collapse: collapse; }
  .users-table thead { background: var(--bg-surface); }
  .users-table th {
    padding: 14px 16px; text-align: left;
    font-size: 12px; font-weight: 600; color: var(--text-muted);
    text-transform: uppercase; letter-spacing: 0.5px;
    border-bottom: 1px solid var(--border);
  }
  .users-table tbody tr { transition: var(--transition); }
  .users-table tbody tr:hover { background: var(--bg-hover); }
  .users-table td { padding: 14px 16px; border-bottom: 1px solid var(--border); vertical-align: middle; }
  .users-table tbody tr:last-child td { border-bottom: none; }

  .user-cell { display: flex; align-items: center; gap: 10px; }
  .user-avatar { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
  .user-avatar--fallback {
    display: flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, var(--primary), var(--accent));
    color: #fff; font-size: 14px; font-weight: 700;
  }
  .user-name { font-weight: 600; color: var(--text-primary); font-size: 14px; }
  .user-email { font-size: 13px; color: var(--text-secondary); }
  .user-phone { font-size: 13px; color: var(--text-secondary); }
  .user-date { font-size: 13px; color: var(--text-secondary); }

  .role-select {
    padding: 6px 12px; border-radius: var(--radius-full);
    font-size: 12px; font-weight: 600; border: 1px solid transparent;
    cursor: pointer; outline: none; transition: var(--transition);
    appearance: none;
  }
  .role-select--tenant   { background: rgba(16,185,129,0.1);   color: var(--success); border-color: rgba(16,185,129,0.3); }
  .role-select--landlord { background: rgba(59,130,246,0.1);   color: #60a5fa; border-color: rgba(59,130,246,0.3); }
  .role-select--admin    { background: var(--primary-50);  color: var(--primary-dark); border-color: var(--primary-100); }
  .role-select:disabled { opacity: 0.5; cursor: not-allowed; }
  .role-select option { background: var(--bg-card); color: var(--text-primary); font-size: 13px; }

  .users-loading { display: flex; flex-direction: column; gap: 10px; }
  .user-skeleton { height: 60px; border-radius: var(--radius-md); background: linear-gradient(90deg, var(--bg-card) 25%, var(--bg-hover) 50%, var(--bg-card) 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; }
  @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
  .users-empty { text-align: center; padding: 32px; color: var(--text-secondary); font-size: 14px; }
`;

export default AdminUsers;
