import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { notificationService } from '../services/notificationService';

const TYPE_META = {
  request:     { icon: '🤝', label: 'Ở ghép',    color: '#0d9488' },
  appointment: { icon: '📅', label: 'Lịch hẹn',  color: '#3b82f6' },
  message:     { icon: '💬', label: 'Tin nhắn',   color: '#10b981' },
};

const getMsg = (n) => {
  if (n.message) return n.message;
  if (n.payload?.message) return n.payload.message;
  return TYPE_META[n.type]?.label ? `${TYPE_META[n.type].icon} Thông báo mới về ${TYPE_META[n.type].label}` : '🔔 Thông báo mới';
};

const getLink = (n) => {
  const p = n.payload || {};
  if (n.type === 'request') {
    // Link về trang phòng hoặc my-requests (tenant thấy phòng, landlord thấy dashboard)
    if (p.room_id) return `/rooms/${p.room_id}`;
    return '/my-requests';
  }
  if (n.type === 'appointment') return '/appointments';
  if (n.type === 'message')     return '/chat';
  return null;
};

const NotificationsPage = () => {
  const { isAuthenticated, user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [filter, setFilter]               = useState('all'); // all | unread | request | appointment | message

  const fetchAll = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const { data } = await notificationService.getAll();
      setNotifications(Array.isArray(data) ? data : []);
      setError(null);
    } catch {
      setError('Không thể tải thông báo. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Realtime subscription
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    const unsub = notificationService.subscribeRealtime(user.id, (newNotif) => {
      setNotifications(prev => [newNotif, ...prev]);
    });
    return unsub;
  }, [isAuthenticated, user?.id]);

  const markRead = async (id) => {
    try {
      await notificationService.markRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch { /* mark-read may fail silently */ }
  };

  const markAllRead = async () => {
    try {
      await notificationService.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch { /* mark-all-read may fail silently */ }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const filtered = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter === 'all')    return true;
    return n.type === filter;
  });

  const counts = {
    all:         notifications.length,
    unread:      notifications.filter(n => !n.read).length,
    request:     notifications.filter(n => n.type === 'request').length,
    appointment: notifications.filter(n => n.type === 'appointment').length,
    message:     notifications.filter(n => n.type === 'message').length,
  };

  return (
    <div className="notif-page">
      <div className="container">
        {/* Header */}
        <div className="notif-header animate-slideUp">
          <div>
            <h1 className="notif-title">🔔 Thông báo</h1>
            <p className="notif-sub">
              {unreadCount > 0
                ? `Bạn có ${unreadCount} thông báo chưa đọc`
                : 'Tất cả thông báo đã được đọc'}
            </p>
          </div>
          {unreadCount > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={markAllRead}>
              ✓ Đánh dấu tất cả đã đọc
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="notif-tabs animate-slideUp">
          {[
            { key: 'all',         label: 'Tất cả'   },
            { key: 'unread',      label: 'Chưa đọc' },
            { key: 'request',     label: '🤝 Ở ghép' },
            { key: 'appointment', label: '📅 Lịch hẹn' },
            { key: 'message',     label: '💬 Tin nhắn' },
          ].map(t => (
            <button
              key={t.key}
              id={`notif-tab-${t.key}`}
              className={`notif-tab ${filter === t.key ? 'notif-tab--active' : ''}`}
              onClick={() => setFilter(t.key)}
            >
              {t.label}
              {counts[t.key] > 0 && (
                <span className="notif-tab-count">{counts[t.key]}</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="notif-skeleton-list">
            {[1, 2, 3, 4].map(i => <div key={i} className="skeleton notif-skeleton" />)}
          </div>
        ) : error ? (
          <div className="notif-empty">
            <span>⚠️</span>
            <p>{error}</p>
            <button className="btn btn-primary btn-sm" onClick={fetchAll}>Thử lại</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="notif-empty">
            <span>🔕</span>
            <p>{filter === 'unread' ? 'Không có thông báo chưa đọc.' : 'Không có thông báo nào.'}</p>
          </div>
        ) : (
          <ul className="notif-list animate-fadeIn">
            {filtered.map(n => {
              const meta = TYPE_META[n.type] || { icon: '🔔', color: 'var(--primary)' };
              const link = getLink(n);
              const msg  = getMsg(n);

              const itemContent = (
                <>
                  <div className="notif-type-icon" style={{ color: meta.color }}>
                    {meta.icon}
                  </div>
                  <div className="notif-item__body">
                    <p className="notif-msg">{msg}</p>
                    <span className="notif-time">
                      {new Date(n.created_at).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  </div>
                  <div className="notif-item__right">
                    {!n.read && <span className="notif-dot-badge" />}
                    {!n.read && (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); markRead(n.id); }}
                      >
                        ✓ Đọc
                      </button>
                    )}
                  </div>
                </>
              );

              return link ? (
                <li
                  key={n.id}
                  id={`notif-item-${n.id}`}
                  className={`notif-item ${n.read ? 'read' : 'unread'}`}
                  onClick={() => !n.read && markRead(n.id)}
                >
                  <Link to={link} style={{ display: 'contents' }}>
                    {itemContent}
                  </Link>
                </li>
              ) : (
                <li
                  key={n.id}
                  id={`notif-item-${n.id}`}
                  className={`notif-item ${n.read ? 'read' : 'unread'}`}
                  onClick={() => !n.read && markRead(n.id)}
                >
                  {itemContent}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <style>{`
        .notif-page { padding: 28px 0 64px; min-height: 80vh; }
        .notif-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          margin-bottom: 24px; flex-wrap: wrap; gap: 16px;
        }
        .notif-title { font-size: 24px; font-weight: 800; color: var(--text-primary); margin-bottom: 4px; }
        .notif-sub { font-size: 13px; color: var(--text-secondary); }

        /* Tabs */
        .notif-tabs { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 24px; border-bottom: 1px solid var(--border); padding-bottom: 8px; }
        .notif-tab {
          display: flex; align-items: center; gap: 6px;
          padding: 8px 14px; border-radius: var(--radius-sm);
          border: none; background: transparent;
          color: var(--text-secondary); font-size: 13px; font-weight: 500;
          cursor: pointer; transition: var(--transition);
        }
        .notif-tab:hover { color: var(--text-primary); background: var(--bg-hover); }
        .notif-tab--active { background: var(--primary-50); color: var(--primary-dark); font-weight: 600; }
        .notif-tab-count { background: var(--bg-hover); padding: 1px 6px; border-radius: 10px; font-size: 11px; font-weight: 700; }
        .notif-tab--active .notif-tab-count { background: var(--primary-100); }

        /* List */
        .notif-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
        .notif-item {
          display: flex; align-items: center; gap: 16px;
          padding: 16px 20px; border-radius: var(--radius-sm);
          background: var(--bg-surface); border: 1px solid var(--border);
          transition: var(--transition); cursor: pointer;
        }
        .notif-item.unread { border-color: var(--primary-100); background: var(--primary-50); }
        .notif-item:hover { box-shadow: var(--shadow-xs); }
        .notif-type-icon { font-size: 24px; flex-shrink: 0; }
        .notif-item__body { flex: 1; }
        .notif-msg { font-size: 13px; color: var(--text-primary); margin: 0 0 4px; line-height: 1.5; }
        .notif-time { font-size: 12px; color: var(--text-muted); }
        .notif-item__right { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; flex-shrink: 0; }
        .notif-dot-badge { width: 8px; height: 8px; border-radius: 50%; background: var(--primary); }

        /* Empty */
        .notif-empty {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 12px; padding: 64px 24px;
          text-align: center; color: var(--text-secondary);
          border: 1px dashed var(--border); border-radius: var(--radius-sm);
          background: var(--bg-warm);
        }
        .notif-empty span { font-size: 36px; }
        .notif-empty p { font-size: 13px; margin: 0; }

        /* Skeleton */
        .notif-skeleton-list { display: flex; flex-direction: column; gap: 8px; }
        .notif-skeleton {
          height: 72px; border-radius: var(--radius-sm);
          background: linear-gradient(90deg,var(--bg-hover) 25%,var(--border) 50%,var(--bg-hover) 75%);
          background-size: 200% 100%; animation: shimmer 1.5s infinite;
        }
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }

        @media (max-width: 600px) {
          .notif-item { flex-wrap: wrap; }
          .notif-item__right { flex-direction: row; }
        }
      `}</style>
    </div>
  );
};

export default NotificationsPage;
