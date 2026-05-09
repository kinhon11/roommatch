import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { roomService } from '../../services/roomService';
import { formatCurrency, formatDate } from '../../utils/format';

const STATUS_MAP = {
  pending:  { label: 'Chờ duyệt', cls: 'badge-pending' },
  approved: { label: 'Đã duyệt',  cls: 'badge-approved' },
  rejected: { label: 'Bị từ chối', cls: 'badge-rejected' },
};

const LandlordDashboard = () => {
  const { user } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    roomService.getMyRooms()
      .then((data) => setRooms(Array.isArray(data) ? data : []))
      .catch(() => setRooms([]))
      .finally(() => setLoading(false));
  }, []);

  const stats = {
    total: rooms.length,
    approved: rooms.filter((r) => r.status === 'approved').length,
    pending: rooms.filter((r) => r.status === 'pending').length,
    rejected: rooms.filter((r) => r.status === 'rejected').length,
  };

  return (
    <div className="ld-page">
      <div className="container">
        {/* ── Welcome ── */}
        <div className="ld-welcome animate-slideUp">
          <div className="ld-welcome__text">
            <h1 className="ld-welcome__title">
              Xin chào, <span>{user?.full_name?.split(' ').pop()}</span> 👋
            </h1>
            <p className="ld-welcome__sub">Quản lý phòng trọ và theo dõi hoạt động của bạn</p>
          </div>
          <Link to="/landlord/post" className="btn btn-primary btn-lg">
            ✏️ Đăng tin mới
          </Link>
        </div>

        {/* ── Stats ── */}
        <div className="ld-stats animate-slideUp" style={{ animationDelay: '.05s' }}>
          {[
            { value: stats.total, label: 'Tổng phòng', icon: '🏠', color: '#0d9488' },
            { value: stats.approved, label: 'Đã duyệt', icon: '✅', color: '#16a34a' },
            { value: stats.pending, label: 'Chờ duyệt', icon: '⏳', color: '#ea580c' },
            { value: stats.rejected, label: 'Bị từ chối', icon: '❌', color: '#dc2626' },
          ].map((s) => (
            <div key={s.label} className="ld-stat-card">
              <div className="ld-stat-card__icon" style={{ background: `${s.color}10`, color: s.color }}>
                {s.icon}
              </div>
              <div>
                <p className="ld-stat-card__value">{loading ? '-' : s.value}</p>
                <p className="ld-stat-card__label">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Quick Actions ── */}
        <div className="ld-actions animate-slideUp" style={{ animationDelay: '.1s' }}>
          <Link to="/landlord/post" className="ld-action-card">
            <span className="ld-action-card__icon">✏️</span>
            <div>
              <p className="ld-action-card__title">Đăng tin mới</p>
              <p className="ld-action-card__desc">Tạo bài đăng cho phòng trọ</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </Link>
          <Link to="/landlord/my-rooms" className="ld-action-card">
            <span className="ld-action-card__icon">📋</span>
            <div>
              <p className="ld-action-card__title">Quản lý phòng</p>
              <p className="ld-action-card__desc">Xem & chỉnh sửa các phòng</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </Link>
          <Link to="/appointments" className="ld-action-card">
            <span className="ld-action-card__icon">📅</span>
            <div>
              <p className="ld-action-card__title">Lịch hẹn</p>
              <p className="ld-action-card__desc">Xem lịch hẹn xem phòng</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </Link>
          <Link to="/landlord/requests" className="ld-action-card">
            <span className="ld-action-card__icon">🤝</span>
            <div>
              <p className="ld-action-card__title">Yêu cầu ở ghép</p>
              <p className="ld-action-card__desc">Duyệt yêu cầu từ tenant</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </Link>
          <Link to="/chat" className="ld-action-card">
            <span className="ld-action-card__icon">💬</span>
            <div>
              <p className="ld-action-card__title">Tin nhắn</p>
              <p className="ld-action-card__desc">Chat với người thuê</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </Link>
        </div>

        {/* ── Recent Rooms ── */}
        <div className="ld-section animate-slideUp" style={{ animationDelay: '.15s' }}>
          <div className="ld-section__header">
            <h2 className="ld-section__title">Phòng gần đây</h2>
            <Link to="/landlord/my-rooms" className="ld-section__link">Xem tất cả →</Link>
          </div>

          {loading ? (
            <div className="ld-rooms-loading">
              {[1, 2, 3].map((i) => (
                <div key={i} className="ld-room-skeleton" />
              ))}
            </div>
          ) : rooms.length === 0 ? (
            <div className="ld-empty">
              <span>🏡</span>
              <p>Bạn chưa đăng phòng nào.</p>
              <Link to="/landlord/post" className="btn btn-primary">Đăng tin ngay</Link>
            </div>
          ) : (
            <div className="ld-rooms-list">
              {rooms.slice(0, 5).map((room) => {
                const img = room.room_images?.find((x) => x.is_primary) || room.room_images?.[0];
                const s = STATUS_MAP[room.status] || STATUS_MAP.pending;
                return (
                  <div key={room.id} className="ld-room-row">
                    <div className="ld-room-row__img">
                      {img ? (
                        <img src={img.image_url} alt={room.title} />
                      ) : (
                        <div className="ld-room-row__img-fallback">🏠</div>
                      )}
                    </div>
                    <div className="ld-room-row__info">
                      <h3>{room.title}</h3>
                      <p>📍 {room.address}, {room.city}</p>
                    </div>
                    <div className="ld-room-row__price">{formatCurrency(room.price)}/th</div>
                    <span className={`badge ${s.cls}`}>{s.label}</span>
                    <p className="ld-room-row__date">{formatDate(room.created_at)}</p>
                    <Link to={`/landlord/edit/${room.id}`} className="btn btn-ghost btn-sm">Sửa</Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <style>{ldStyles}</style>
    </div>
  );
};

const ldStyles = `
  .ld-page { padding: 32px 0 80px; }

  /* Welcome */
  .ld-welcome {
    display: flex; align-items: center; justify-content: space-between;
    flex-wrap: wrap; gap: 16px; margin-bottom: 28px;
  }
  .ld-welcome__title {
    font-size: 26px; font-weight: 800; color: var(--text-primary);
  }
  .ld-welcome__title span { color: var(--primary); }
  .ld-welcome__sub { font-size: 14px; color: var(--text-secondary); margin-top: 4px; }

  /* Stats */
  .ld-stats {
    display: grid; grid-template-columns: repeat(4, 1fr);
    gap: 14px; margin-bottom: 28px;
  }
  @media(max-width: 768px) { .ld-stats { grid-template-columns: repeat(2, 1fr); } }

  .ld-stat-card {
    display: flex; align-items: center; gap: 14px;
    padding: 18px 20px;
    background: var(--bg-card); border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    transition: var(--transition);
  }
  .ld-stat-card:hover { border-color: var(--border-hover); box-shadow: var(--shadow-sm); }
  .ld-stat-card__icon {
    width: 44px; height: 44px;
    border-radius: var(--radius-md);
    display: flex; align-items: center; justify-content: center;
    font-size: 20px; flex-shrink: 0;
  }
  .ld-stat-card__value { font-size: 22px; font-weight: 800; color: var(--text-primary); font-variant-numeric: tabular-nums; }
  .ld-stat-card__label { font-size: 12px; color: var(--text-muted); font-weight: 500; margin-top: 2px; }

  /* Quick actions */
  .ld-actions {
    display: grid; grid-template-columns: repeat(5, 1fr);
    gap: 14px; margin-bottom: 32px;
  }
  @media(max-width: 1200px) { .ld-actions { grid-template-columns: repeat(3, 1fr); } }
  @media(max-width: 700px) { .ld-actions { grid-template-columns: repeat(2, 1fr); } }
  @media(max-width: 500px)  { .ld-actions { grid-template-columns: 1fr; } }

  .ld-action-card {
    display: flex; align-items: center; gap: 12px;
    padding: 16px 18px;
    background: var(--bg-card); border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    transition: var(--transition); cursor: pointer;
  }
  .ld-action-card:hover { border-color: var(--primary); box-shadow: var(--shadow-sm); transform: translateY(-1px); }
  .ld-action-card__icon { font-size: 22px; flex-shrink: 0; }
  .ld-action-card__title { font-size: 14px; font-weight: 600; color: var(--text-primary); }
  .ld-action-card__desc { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
  .ld-action-card svg { margin-left: auto; color: var(--text-muted); flex-shrink: 0; }

  /* Section */
  .ld-section { margin-bottom: 32px; }
  .ld-section__header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 16px;
  }
  .ld-section__title { font-size: 18px; font-weight: 700; color: var(--text-primary); }
  .ld-section__link { font-size: 13px; color: var(--primary); font-weight: 600; }
  .ld-section__link:hover { text-decoration: underline; }

  /* Room rows */
  .ld-rooms-list {
    background: var(--bg-card); border: 1px solid var(--border);
    border-radius: var(--radius-lg); overflow: hidden;
  }
  .ld-room-row {
    display: flex; align-items: center; gap: 14px;
    padding: 14px 18px;
    border-bottom: 1px solid var(--border);
    transition: var(--transition);
  }
  .ld-room-row:last-child { border-bottom: none; }
  .ld-room-row:hover { background: var(--bg-hover); }

  .ld-room-row__img {
    width: 52px; height: 40px; border-radius: var(--radius-sm);
    overflow: hidden; flex-shrink: 0; background: var(--bg-inset);
  }
  .ld-room-row__img img { width: 100%; height: 100%; object-fit: cover; }
  .ld-room-row__img-fallback {
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    font-size: 20px; color: var(--text-muted);
  }
  .ld-room-row__info { flex: 1; min-width: 0; }
  .ld-room-row__info h3 {
    font-size: 14px; font-weight: 600; color: var(--text-primary);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .ld-room-row__info p { font-size: 12px; color: var(--text-muted); }
  .ld-room-row__price {
    font-size: 14px; font-weight: 700; color: var(--primary);
    white-space: nowrap; font-variant-numeric: tabular-nums;
  }
  .ld-room-row__date { font-size: 12px; color: var(--text-muted); white-space: nowrap; }

  /* Loading & Empty */
  .ld-rooms-loading { display: flex; flex-direction: column; gap: 10px; }
  .ld-room-skeleton {
    height: 60px; border-radius: var(--radius-md);
    background: linear-gradient(90deg, var(--bg-hover) 25%, var(--border) 50%, var(--bg-hover) 75%);
    background-size: 200% 100%; animation: shimmer 1.5s infinite;
  }
  .ld-empty {
    text-align: center; padding: 64px 24px;
    background: var(--bg-card); border: 1px dashed var(--border);
    border-radius: var(--radius-xl);
    display: flex; flex-direction: column; align-items: center; gap: 12px;
  }
  .ld-empty span { font-size: 48px; }
  .ld-empty p { color: var(--text-secondary); font-size: 15px; }

  @media(max-width: 768px) {
    .ld-room-row { flex-wrap: wrap; }
    .ld-room-row__price { order: -1; }
    .ld-room-row__date { display: none; }
  }
`;

export default LandlordDashboard;
