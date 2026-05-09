import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { notificationService } from '../../services/notificationService';
import { useAuth } from '../../hooks/useAuth';

/**
 * NotificationBell — Navbar component
 * Hiển thị số thông báo chưa đọc + dropdown.
 * Sử dụng Supabase Realtime để nhận thông báo mới tức thì.
 */
const NotificationBell = () => {
  const { isAuthenticated, user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [open, setOpen]                   = useState(false);
  const [pulse, setPulse]                 = useState(false); // animation khi có notif mới
  const dropdownRef = useRef(null);

  // ── Fetch initial notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const { data } = await notificationService.getAll();
      const list = Array.isArray(data) ? data : [];
      setNotifications(list);
      setUnreadCount(list.filter(n => !n.read).length);
    } catch { /* notification fetch may fail silently */ }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchNotifications();
  }, [isAuthenticated, fetchNotifications]);

  // ── Supabase Realtime subscription
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    const unsubscribe = notificationService.subscribeRealtime(user.id, (newNotif) => {
      setNotifications(prev => [newNotif, ...prev]);
      setUnreadCount(c => c + 1);
      // Pulse animation
      setPulse(true);
      setTimeout(() => setPulse(false), 2000);
    });

    return unsubscribe;
  }, [isAuthenticated, user?.id]);

  // ── Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAsRead = async (id) => {
    try {
      await notificationService.markRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadCount(c => Math.max(c - 1, 0));
    } catch { /* mark-read may fail silently */ }
  };

  const markAllRead = async () => {
    try {
      await notificationService.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch { /* mark-all-read may fail silently */ }
  };

  // Render notification message from payload
  const renderMsg = (n) => {
    if (n.message) return n.message;
    if (n.payload?.message) return n.payload.message;
    const typeMap = {
      request:     '🤝 Bạn có yêu cầu ở ghép mới',
      appointment: '📅 Lịch hẹn mới được đặt',
      message:     '💬 Bạn có tin nhắn mới',
    };
    return typeMap[n.type] || '🔔 Thông báo mới';
  };

  if (!isAuthenticated) return null;

  return (
    <div className="notification-bell" ref={dropdownRef}>
      <button
        id="btn-notification-bell"
        className={`bell-btn ${pulse ? 'bell-btn--pulse' : ''}`}
        onClick={() => { setOpen(v => !v); if (!open) fetchNotifications(); }}
        aria-label={`Thông báo${unreadCount > 0 ? ` (${unreadCount} chưa đọc)` : ''}`}
      >
        🔔
        {unreadCount > 0 && (
          <span className="badge-unread">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notification-dropdown animate-fadeIn">
          <div className="dropdown-header">
            <h4>Thông báo</h4>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              {unreadCount > 0 && (
                <button className="btn-mark-all" onClick={markAllRead}>✓ Đọc tất cả</button>
              )}
              <Link to="/notifications" className="view-all" onClick={() => setOpen(false)}>
                Xem tất cả
              </Link>
            </div>
          </div>

          <ul className="notification-list">
            {notifications.length === 0 && (
              <li className="notif-empty-item">🔕 Không có thông báo mới.</li>
            )}
            {notifications.slice(0, 6).map(n => (
              <li
                key={n.id}
                className={`notification-item ${n.read ? '' : 'unread'}`}
                onClick={() => !n.read && markAsRead(n.id)}
              >
                <div className="notif-dot-sm" />
                <div className="notif-content">
                  <p className="msg">{renderMsg(n)}</p>
                  <span className="time">
                    {new Date(n.created_at).toLocaleString('vi-VN', {
                      dateStyle: 'short', timeStyle: 'short'
                    })}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <style>{`
        .notification-bell { position: relative; }
        .bell-btn {
          background: none; border: none; cursor: pointer; font-size: 20px;
          position: relative; color: var(--text-secondary); transition: var(--transition);
          padding: 6px; border-radius: var(--radius-sm);
        }
        .bell-btn:hover { color: var(--primary); background: var(--primary-50); }
        .bell-btn--pulse { animation: bell-pulse 0.5s ease; }
        @keyframes bell-pulse {
          0%   { transform: scale(1); }
          30%  { transform: scale(1.3) rotate(-15deg); }
          60%  { transform: scale(1.1) rotate(10deg); }
          100% { transform: scale(1); }
        }
        .badge-unread {
          position: absolute; top: 0; right: 0;
          background: var(--danger); color: #fff;
          border-radius: var(--radius-full); padding: 1px 5px;
          font-size: 10px; font-weight: 700; min-width: 16px;
          text-align: center; line-height: 16px;
          border: 2px solid var(--bg-base);
        }
        .notification-dropdown {
          position: absolute; right: 0; top: calc(100% + 10px);
          width: 320px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-lg);
          z-index: 1000; overflow: hidden;
        }
        .dropdown-header {
          display: flex; justify-content: space-between; align-items: center;
          padding: 14px 16px;
          border-bottom: 1px solid var(--border);
          background: var(--bg-surface);
        }
        .dropdown-header h4 { font-size: 14px; font-weight: 700; color: var(--text-primary); }
        .view-all { font-size: 12px; color: var(--primary-light); font-weight: 500; }
        .view-all:hover { text-decoration: underline; }
        .btn-mark-all {
          font-size: 11px; color: var(--text-muted); background: none; border: none;
          cursor: pointer; padding: 2px 6px; border-radius: 4px; transition: var(--transition);
        }
        .btn-mark-all:hover { background: var(--bg-hover); color: var(--text-primary); }
        .notification-list { list-style: none; margin: 0; padding: 0; max-height: 360px; overflow-y: auto; }
        .notification-item {
          display: flex; align-items: flex-start; gap: 10px;
          padding: 12px 16px; cursor: pointer; transition: var(--transition);
          border-bottom: 1px solid var(--border);
        }
        .notification-item:last-child { border-bottom: none; }
        .notification-item:hover { background: var(--bg-hover); }
        .notification-item.unread { background: var(--primary-50); }
        .notif-dot-sm {
          width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; margin-top: 5px;
          background: var(--border);
        }
        .notification-item.unread .notif-dot-sm { background: var(--primary); }
        .notif-content { flex: 1; }
        .msg { margin: 0 0 3px; font-size: 13px; color: var(--text-primary); line-height: 1.4; }
        .time { font-size: 11px; color: var(--text-muted); }
        .notif-empty-item { padding: 24px 16px; text-align: center; color: var(--text-muted); font-size: 13px; }
      `}</style>
    </div>
  );
};

export default NotificationBell;
