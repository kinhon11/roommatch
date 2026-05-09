import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { roomService } from '../../services/roomService';
import { formatCurrency, formatDate } from '../../utils/format';

const LandlordProfile = () => {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await roomService.getLandlordProfile(id);
      setData(res);
    } catch {
      setError('Không tìm thấy chủ nhà.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  if (loading) return (
    <div className="landlord-profile-page">
      <div className="container"><div className="loading-screen"><div className="spinner" /><p>Đang tải...</p></div></div>
      <style>{styles}</style>
    </div>
  );

  if (error || !data) return (
    <div className="landlord-profile-page">
      <div className="container">
        <div className="lp-empty"><span>😔</span><h3>{error || 'Không tìm thấy'}</h3>
          <Link to="/rooms" className="btn btn-primary">← Về danh sách phòng</Link>
        </div>
      </div>
      <style>{styles}</style>
    </div>
  );

  const { landlord, rooms, stats } = data;

  return (
    <div className="landlord-profile-page">
      <div className="container">
        {/* Breadcrumb */}
        <nav className="breadcrumb animate-slideUp">
          <Link to="/">Trang chủ</Link><span>›</span>
          <Link to="/rooms">Tìm phòng</Link><span>›</span>
          <span>Chủ nhà: {landlord.full_name}</span>
        </nav>

        {/* Profile card */}
        <div className="lp-hero animate-slideUp">
          <div className="lp-avatar-wrap">
            {landlord.avatar_url
              ? <img src={landlord.avatar_url} alt="" className="lp-avatar" />
              : <div className="lp-avatar lp-avatar--fallback">{(landlord.full_name || 'C')[0]}</div>
            }
          </div>
          <div className="lp-info">
            <h1 className="lp-name">
              {landlord.full_name}
              {landlord.is_verified && <span className="lp-verified" title="Chủ nhà đã xác minh">✓ Đã xác minh</span>}
            </h1>
            {landlord.phone && <p className="lp-phone">📞 {landlord.phone}</p>}
            <p className="lp-joined">📅 Tham gia từ {formatDate(landlord.created_at)}</p>
          </div>
          <div className="lp-stats">
            <div className="lp-stat">
              <strong>{stats.totalRooms}</strong>
              <span>Phòng đăng</span>
            </div>
            <div className="lp-stat">
              <strong>{stats.approvedRooms}</strong>
              <span>Đã duyệt</span>
            </div>
          </div>
        </div>

        {/* Room list */}
        <div className="lp-rooms-header animate-slideUp" style={{ animationDelay: '.05s' }}>
          <h2>🏠 Phòng đang cho thuê ({rooms.length})</h2>
        </div>

        {rooms.length === 0 ? (
          <div className="lp-empty"><span>🏠</span><p>Chủ nhà chưa có phòng nào.</p></div>
        ) : (
          <div className="lp-rooms-grid animate-fadeIn">
            {rooms.map((room, i) => {
              const img = room.room_images?.find(x => x.is_primary) || room.room_images?.[0];
              return (
                <Link key={room.id} to={`/rooms/${room.id}`} className="room-card animate-slideUp" style={{ animationDelay: `${i * 0.04}s` }}>
                  <div className="room-card__img-wrap">
                    {img ? <img src={img.image_url} alt={room.title} className="room-card__img" loading="lazy" />
                      : <div className="room-card__img-placeholder">🏠</div>}
                    <div className="room-card__price-tag">{formatCurrency(room.price)}<span>/tháng</span></div>
                    {!room.is_available && <div className="room-card__badge room-card__badge--full">Hết phòng</div>}
                  </div>
                  <div className="room-card__body">
                    <h3 className="room-card__title">{room.title}</h3>
                    <p className="room-card__location">📍 {room.address}, {room.city}</p>
                    <div className="room-card__meta">
                      {room.area && <span>📐 {room.area} m²</span>}
                      {room.available_slots > 0 && <span>👥 {room.available_slots} chỗ</span>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
      <style>{styles}</style>
    </div>
  );
};

const styles = `
  .landlord-profile-page { padding: 28px 0 64px; }
  .breadcrumb { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-muted); margin-bottom: 24px; }
  .breadcrumb a { color: var(--text-secondary); transition: var(--transition); }
  .breadcrumb a:hover { color: var(--primary); }

  .lp-hero {
    display: flex; align-items: center; gap: 24px; flex-wrap: wrap;
    background: var(--bg-card); border: 1px solid var(--border);
    border-radius: var(--radius-xl); padding: 32px;
    margin-bottom: 32px;
  }
  .lp-avatar-wrap { flex-shrink: 0; }
  .lp-avatar {
    width: 80px; height: 80px; border-radius: 50%; object-fit: cover;
  }
  .lp-avatar--fallback {
    display: flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, var(--primary), var(--primary-light));
    color: #fff; font-size: 32px; font-weight: 800;
  }
  .lp-info { flex: 1; min-width: 200px; }
  .lp-name {
    font-size: 22px; font-weight: 800; color: var(--text-primary);
    display: flex; align-items: center; gap: 10px; margin-bottom: 8px;
  }
  .lp-verified {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 3px 10px; border-radius: var(--radius-full);
    background: var(--primary-50); color: var(--primary-dark);
    font-size: 12px; font-weight: 600;
  }
  .lp-phone { font-size: 14px; color: var(--text-secondary); margin-bottom: 4px; }
  .lp-joined { font-size: 13px; color: var(--text-muted); }

  .lp-stats { display: flex; gap: 16px; }
  .lp-stat {
    display: flex; flex-direction: column; align-items: center;
    padding: 16px 24px; background: var(--bg-warm);
    border: 1px solid var(--border-subtle); border-radius: var(--radius-md);
    min-width: 90px;
  }
  .lp-stat strong { font-size: 22px; font-weight: 800; color: var(--primary); font-variant-numeric: tabular-nums; }
  .lp-stat span { font-size: 12px; color: var(--text-muted); margin-top: 2px; }

  .lp-rooms-header { margin-bottom: 20px; }
  .lp-rooms-header h2 { font-size: 20px; font-weight: 700; color: var(--text-primary); }

  .lp-rooms-grid {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;
  }
  @media(max-width: 1024px) { .lp-rooms-grid { grid-template-columns: repeat(2, 1fr); } }
  @media(max-width: 600px)  { .lp-rooms-grid { grid-template-columns: 1fr; } }

  .lp-empty {
    text-align: center; padding: 60px 24px;
    background: var(--bg-card); border: 1px dashed var(--border);
    border-radius: var(--radius-xl);
    display: flex; flex-direction: column; align-items: center; gap: 12px;
  }
  .lp-empty span { font-size: 48px; }
  .lp-empty h3 { font-size: 18px; font-weight: 700; color: var(--text-primary); }
  .lp-empty p { color: var(--text-secondary); }

  /* Reuse room-card styles from RoomsPage */
  .room-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; transition: var(--transition); display: flex; flex-direction: column; }
  .room-card:hover { border-color: var(--border-hover); box-shadow: var(--shadow-card-hover); transform: translateY(-3px); }
  .room-card__img-wrap { position: relative; aspect-ratio: 16/10; overflow: hidden; background: var(--bg-inset); }
  .room-card__img { width: 100%; height: 100%; object-fit: cover; transition: transform .4s var(--ease-out); }
  .room-card:hover .room-card__img { transform: scale(1.04); }
  .room-card__img-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 40px; color: var(--text-muted); }
  .room-card__price-tag { position: absolute; bottom: 10px; left: 10px; background: rgba(26,35,50,.85); backdrop-filter: blur(8px); color: #fff; padding: 5px 12px; border-radius: var(--radius-sm); font-size: 14px; font-weight: 700; }
  .room-card__price-tag span { font-weight: 400; font-size: 12px; opacity: .7; margin-left: 2px; }
  .room-card__badge { position: absolute; top: 10px; right: 10px; padding: 3px 10px; border-radius: var(--radius-full); font-size: 11px; font-weight: 700; }
  .room-card__badge--full { background: rgba(239,68,68,.9); color: #fff; }
  .room-card__body { padding: 16px; display: flex; flex-direction: column; gap: 6px; flex: 1; }
  .room-card__title { font-size: 15px; font-weight: 600; color: var(--text-primary); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .room-card__location { font-size: 13px; color: var(--text-muted); }
  .room-card__meta { display: flex; gap: 12px; margin-top: auto; padding-top: 8px; font-size: 12px; color: var(--text-muted); }

  @media(max-width: 768px) {
    .lp-hero { flex-direction: column; text-align: center; padding: 24px; }
    .lp-stats { justify-content: center; }
    .lp-name { justify-content: center; }
  }
`;

export default LandlordProfile;
