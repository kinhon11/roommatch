import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { favoriteService } from '../../services/favoriteService';
import { formatCurrency } from '../../utils/format';

const FavoritesPage = () => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    favoriteService.getFavorites()
      .then((data) => setRooms(Array.isArray(data?.favorites) ? data.favorites : []))
      .catch(() => setRooms([]))
      .finally(() => setLoading(false));
  }, []);

  const handleUnfav = async (roomId) => {
    try {
      await favoriteService.toggleFavorite(roomId, true);
      setRooms((prev) => prev.filter((r) => r.room_id !== roomId && r.id !== roomId));
    } catch { /* ignore */ }
  };

  return (
    <div className="favorites-page">
      <div className="container">
        <div className="fav-header animate-slideUp">
          <div>
            <h1 className="fav-header__title">❤️ Phòng yêu thích</h1>
            <p className="fav-header__sub">
              {loading ? 'Đang tải...' : `${rooms.length} phòng đã lưu`}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="fav-grid">
            {[1, 2, 3].map((i) => (
              <div key={i} className="fav-skeleton">
                <div className="fav-skeleton__img" />
                <div className="fav-skeleton__body">
                  <div className="fav-skeleton__line w80" />
                  <div className="fav-skeleton__line w60" />
                </div>
              </div>
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <div className="fav-empty animate-scaleIn">
            <span>💛</span>
            <h3>Chưa có phòng yêu thích</h3>
            <p>Bấm biểu tượng ❤️ trên trang chi tiết phòng để lưu lại</p>
            <Link to="/rooms" className="btn btn-primary">Khám phá phòng trọ</Link>
          </div>
        ) : (
          <div className="fav-grid animate-fadeIn">
            {rooms.map((item, i) => {
              const room = item.rooms || item;
              const img = room.room_images?.find((x) => x.is_primary) || room.room_images?.[0];
              return (
                <div
                  key={item.id || room.id}
                  className="fav-card animate-slideUp"
                  style={{ animationDelay: `${0.04 * i}s` }}
                >
                  <Link to={`/rooms/${room.id}`} className="fav-card__link">
                    <div className="fav-card__img-wrap">
                      {img ? (
                        <img src={img.image_url} alt={room.title} className="fav-card__img" />
                      ) : (
                        <div className="fav-card__img-placeholder">🏠</div>
                      )}
                      <div className="fav-card__price">
                        {formatCurrency(room.price)}<span>/tháng</span>
                      </div>
                    </div>
                    <div className="fav-card__body">
                      <h3 className="fav-card__title">{room.title}</h3>
                      <p className="fav-card__location">📍 {room.address}, {room.city}</p>
                    </div>
                  </Link>
                  <button
                    className="fav-card__remove"
                    onClick={() => handleUnfav(item.room_id || room.id)}
                    title="Bỏ yêu thích"
                  >
                    ❌
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{favStyles}</style>
    </div>
  );
};

const favStyles = `
  .favorites-page { padding: 32px 0 80px; }

  .fav-header { margin-bottom: 24px; }
  .fav-header__title { font-size: 26px; font-weight: 800; color: var(--text-primary); margin-bottom: 4px; }
  .fav-header__sub { font-size: 14px; color: var(--text-secondary); }

  .fav-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
  }
  @media(max-width: 1024px) { .fav-grid { grid-template-columns: repeat(2, 1fr); } }
  @media(max-width: 600px)  { .fav-grid { grid-template-columns: 1fr; } }

  .fav-card {
    position: relative;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    transition: var(--transition);
  }
  .fav-card:hover { border-color: var(--border-hover); box-shadow: var(--shadow-card-hover); transform: translateY(-2px); }

  .fav-card__link { display: flex; flex-direction: column; }
  .fav-card__img-wrap {
    position: relative; aspect-ratio: 16/10; overflow: hidden; background: var(--bg-inset);
  }
  .fav-card__img { width: 100%; height: 100%; object-fit: cover; transition: transform .4s var(--ease-out); }
  .fav-card:hover .fav-card__img { transform: scale(1.04); }
  .fav-card__img-placeholder {
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    font-size: 40px; color: var(--text-muted);
  }
  .fav-card__price {
    position: absolute; bottom: 10px; left: 10px;
    background: rgba(26,35,50,.85); backdrop-filter: blur(8px);
    color: #fff; padding: 5px 12px;
    border-radius: var(--radius-sm); font-size: 14px; font-weight: 700;
  }
  .fav-card__price span { font-weight: 400; font-size: 12px; opacity: .7; margin-left: 2px; }
  .fav-card__body { padding: 16px; }
  .fav-card__title { font-size: 15px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px; }
  .fav-card__location { font-size: 13px; color: var(--text-muted); }

  .fav-card__remove {
    position: absolute; top: 10px; right: 10px;
    background: rgba(255,255,255,.9); backdrop-filter: blur(8px);
    border: none; width: 32px; height: 32px; border-radius: 50%;
    font-size: 14px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: var(--transition); opacity: 0;
  }
  .fav-card:hover .fav-card__remove { opacity: 1; }
  .fav-card__remove:hover { background: #fff; transform: scale(1.1); }

  .fav-empty {
    text-align: center; padding: 80px 24px;
    background: var(--bg-card); border: 1px dashed var(--border);
    border-radius: var(--radius-xl);
    display: flex; flex-direction: column; align-items: center; gap: 12px;
  }
  .fav-empty span { font-size: 48px; }
  .fav-empty h3 { font-size: 20px; font-weight: 700; color: var(--text-primary); }
  .fav-empty p { color: var(--text-secondary); font-size: 14px; max-width: 360px; }

  .fav-skeleton {
    background: var(--bg-card); border: 1px solid var(--border);
    border-radius: var(--radius-lg); overflow: hidden;
  }
  .fav-skeleton__img {
    aspect-ratio: 16/10;
    background: linear-gradient(90deg, var(--bg-hover) 25%, var(--border) 50%, var(--bg-hover) 75%);
    background-size: 200% 100%; animation: shimmer 1.5s infinite;
  }
  .fav-skeleton__body { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
  .fav-skeleton__line {
    height: 12px; border-radius: 6px;
    background: linear-gradient(90deg, var(--bg-hover) 25%, var(--border) 50%, var(--bg-hover) 75%);
    background-size: 200% 100%; animation: shimmer 1.5s infinite;
  }
  .fav-skeleton__line.w80 { width: 80%; }
  .fav-skeleton__line.w60 { width: 60%; }
`;

export default FavoritesPage;
