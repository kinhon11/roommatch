import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { roomService } from '../../services/roomService';
import { formatCurrency } from '../../utils/format';

const HERO_STATS = [
  { value: '10K+', label: 'Phòng trọ', icon: '🏠' },
  { value: '5K+', label: 'Người dùng', icon: '👥' },
  { value: '20+', label: 'Thành phố', icon: '🏙️' },
];

const FEATURES = [
  {
    icon: '🔍',
    title: 'Tìm phòng thông minh',
    desc: 'Lọc theo giá, vị trí, tiện ích. Kết quả chính xác, tiết kiệm thời gian.',
    color: '#0d9488',
  },
  {
    icon: '🤝',
    title: 'Ở ghép dễ dàng',
    desc: 'Gửi yêu cầu ở ghép trực tiếp. Chủ nhà phản hồi nhanh qua hệ thống.',
    color: '#f59e0b',
  },
  {
    icon: '💬',
    title: 'Chat trực tiếp',
    desc: 'Nhắn tin thời gian thực với chủ nhà. Đặt lịch hẹn xem phòng tức thì.',
    color: '#3b82f6',
  },
  {
    icon: '🛡️',
    title: 'An toàn & minh bạch',
    desc: 'Mọi bài đăng được kiểm duyệt. Báo cáo vi phạm được xử lý nhanh chóng.',
    color: '#10b981',
  },
];

const CITIES = [
  { name: 'Hồ Chí Minh', emoji: '🏙️' },
  { name: 'Hà Nội', emoji: '🏛️' },
  { name: 'Đà Nẵng', emoji: '🏖️' },
  { name: 'Cần Thơ', emoji: '🌾' },
  { name: 'Huế', emoji: '🏯' },
  { name: 'Nha Trang', emoji: '🌊' },
];

const Home = () => {
  const [latestRooms, setLatestRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    roomService.getApprovedRooms({ limit: 6, sort: 'newest' })
      .then((data) => setLatestRooms(Array.isArray(data?.rooms) ? data.rooms.slice(0, 6) : []))
      .catch(() => setLatestRooms([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="home-page">

      {/* ═══ HERO ═══ */}
      <section className="hero">
        <div className="hero__bg" />
        <div className="container hero__inner">
          <div className="hero__content animate-slideUp">
            <div className="hero__badge">
              <span className="hero__badge-dot" />
              Nền tảng tìm phòng trọ #1 Việt Nam
            </div>
            <h1 className="hero__title">
              Tìm phòng trọ<br />
              <span className="hero__title-accent">phù hợp với bạn</span>
            </h1>
            <p className="hero__subtitle">
              Kết nối hàng nghìn phòng trọ chất lượng trên khắp Việt Nam.
              Tìm kiếm, so sánh và đặt lịch xem phòng — tất cả trong một nền tảng.
            </p>
            <div className="hero__actions">
              <Link to="/rooms" className="btn btn-primary btn-lg" id="hero-cta-rooms">
                Khám phá phòng trọ
              </Link>
              <Link to="/register" className="btn btn-secondary btn-lg" id="hero-cta-register">
                Đăng ký miễn phí
              </Link>
            </div>
          </div>

          <div className="hero__stats animate-slideUp" style={{ animationDelay: '0.1s' }}>
            {HERO_STATS.map((s) => (
              <div key={s.label} className="hero__stat">
                <span className="hero__stat-icon">{s.icon}</span>
                <strong className="hero__stat-value">{s.value}</strong>
                <span className="hero__stat-label">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FEATURES ═══ */}
      <section className="features">
        <div className="container">
          <div className="section-header animate-slideUp">
            <div className="section-divider" />
            <h2 className="section-title">Tại sao chọn RoommieMatch?</h2>
            <p className="section-desc">
              Giải pháp toàn diện cho việc tìm phòng trọ và bạn ở ghép
            </p>
          </div>

          <div className="features__grid">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className="feature-card animate-slideUp"
                style={{ animationDelay: `${0.05 * i}s` }}
              >
                <div
                  className="feature-card__icon"
                  style={{ background: `${f.color}12`, color: f.color }}
                >
                  {f.icon}
                </div>
                <h3 className="feature-card__title">{f.title}</h3>
                <p className="feature-card__desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CITIES ═══ */}
      <section className="cities">
        <div className="container">
          <div className="section-header animate-slideUp">
            <div className="section-divider" />
            <h2 className="section-title">Khám phá theo thành phố</h2>
            <p className="section-desc">
              Phòng trọ chất lượng trên khắp các thành phố lớn
            </p>
          </div>

          <div className="cities__grid">
            {CITIES.map((city, i) => (
              <Link
                key={city.name}
                to={`/rooms?city=${encodeURIComponent(city.name)}`}
                className="city-chip animate-slideUp"
                style={{ animationDelay: `${0.04 * i}s` }}
              >
                <span className="city-chip__emoji">{city.emoji}</span>
                <span className="city-chip__name">{city.name}</span>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="city-chip__arrow">
                  <path d="M5.25 3.5L8.75 7L5.25 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ LATEST ROOMS ═══ */}
      <section className="latest">
        <div className="container">
          <div className="section-header animate-slideUp">
            <div className="section-divider" />
            <h2 className="section-title">Phòng mới đăng</h2>
            <p className="section-desc">
              Những phòng trọ mới nhất vừa được đăng tải
            </p>
          </div>

          {loading ? (
            <div className="latest__skeleton-grid">
              {[1, 2, 3].map((i) => (
                <div key={i} className="room-skeleton">
                  <div className="room-skeleton__img" />
                  <div className="room-skeleton__body">
                    <div className="room-skeleton__line w80" />
                    <div className="room-skeleton__line w60" />
                    <div className="room-skeleton__line w40" />
                  </div>
                </div>
              ))}
            </div>
          ) : latestRooms.length === 0 ? (
            <div className="latest__empty">
              <span>🏠</span>
              <p>Chưa có phòng nào được đăng tải.</p>
              <Link to="/register" className="btn btn-primary">Đăng ký ngay</Link>
            </div>
          ) : (
            <div className="latest__grid">
              {latestRooms.map((room, i) => {
                const img = room.room_images?.find((x) => x.is_primary) || room.room_images?.[0];
                return (
                  <Link
                    key={room.id}
                    to={`/rooms/${room.id}`}
                    className="room-card animate-slideUp"
                    style={{ animationDelay: `${0.05 * i}s` }}
                  >
                    <div className="room-card__img-wrap">
                      {img ? (
                        <img src={img.image_url} alt={room.title} className="room-card__img" />
                      ) : (
                        <div className="room-card__img-placeholder">🏠</div>
                      )}
                      <div className="room-card__price-tag">
                        {formatCurrency(room.price)}<span>/tháng</span>
                      </div>
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

          <div className="latest__cta animate-slideUp">
            <Link to="/rooms" className="btn btn-secondary btn-lg">
              Xem tất cả phòng →
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="cta-section">
        <div className="container">
          <div className="cta-card animate-slideUp">
            <div className="cta-card__content">
              <h2 className="cta-card__title">Bạn là chủ nhà?</h2>
              <p className="cta-card__desc">
                Đăng tin phòng miễn phí, tiếp cận hàng nghìn người tìm phòng mỗi ngày.
                AI hỗ trợ viết mô tả chuyên nghiệp.
              </p>
              <div className="cta-card__actions">
                <Link to="/register" className="btn btn-accent btn-lg">
                  Đăng tin miễn phí
                </Link>
                <Link to="/rooms" className="btn btn-ghost btn-lg">
                  Tìm hiểu thêm →
                </Link>
              </div>
            </div>
            <div className="cta-card__visual">
              <span>🏡</span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="footer">
        <div className="container footer__inner">
          <div className="footer__brand">
            <span className="footer__logo-mark">R</span>
            <div>
              <p className="footer__logo-text">RoommieMatch</p>
              <p className="footer__tagline">Tìm phòng trọ & bạn ở ghép</p>
            </div>
          </div>
          <div className="footer__links">
            <Link to="/rooms">Tìm phòng</Link>
            <Link to="/register">Đăng ký</Link>
            <Link to="/login">Đăng nhập</Link>
          </div>
          <p className="footer__copy">© 2026 RoommieMatch. All rights reserved.</p>
        </div>
      </footer>

      <style>{homeStyles}</style>
    </div>
  );
};

const homeStyles = `
  .home-page { overflow-x: hidden; }

  /* ═══ HERO ═══ */
  .hero {
    position: relative;
    padding: 100px 0 60px;
    overflow: hidden;
  }
  .hero__bg {
    position: absolute; inset: 0;
    background:
      radial-gradient(ellipse 60% 50% at 20% 30%, rgba(13,148,136,.06) 0%, transparent 70%),
      radial-gradient(ellipse 40% 40% at 80% 60%, rgba(245,158,11,.04) 0%, transparent 70%),
      linear-gradient(180deg, var(--bg-base) 0%, var(--bg-warm) 100%);
    z-index: -1;
  }

  .hero__inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 48px;
  }

  .hero__badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 16px 6px 10px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-full);
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
    box-shadow: var(--shadow-sm);
    margin-bottom: 12px;
  }
  .hero__badge-dot {
    width: 8px; height: 8px;
    background: var(--primary);
    border-radius: 50%;
    animation: pulse-soft 2s infinite;
  }

  .hero__title {
    font-size: clamp(2rem, 5vw, 3.2rem);
    font-weight: 800;
    color: var(--text-primary);
    line-height: 1.15;
    letter-spacing: -0.03em;
    margin-bottom: 16px;
  }
  .hero__title-accent {
    color: var(--primary);
  }

  .hero__subtitle {
    font-size: clamp(15px, 2vw, 17px);
    color: var(--text-secondary);
    max-width: 560px;
    line-height: 1.7;
    margin-bottom: 8px;
  }

  .hero__actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    justify-content: center;
    margin-top: 8px;
  }

  .hero__stats {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
  }
  .hero__stat {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 20px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
    min-width: 160px;
  }
  .hero__stat-icon { font-size: 22px; }
  .hero__stat-value {
    font-size: 20px;
    font-weight: 800;
    color: var(--primary);
    font-variant-numeric: tabular-nums;
  }
  .hero__stat-label {
    font-size: 13px;
    color: var(--text-muted);
    font-weight: 500;
  }

  /* ═══ SECTION HEADERS ═══ */
  .section-header {
    margin-bottom: 36px;
  }
  .section-title {
    font-size: clamp(22px, 3vw, 28px);
    font-weight: 800;
    color: var(--text-primary);
    margin-bottom: 8px;
  }
  .section-desc {
    font-size: 15px;
    color: var(--text-secondary);
    max-width: 480px;
  }

  /* ═══ FEATURES ═══ */
  .features {
    padding: 64px 0;
    background: var(--bg-surface);
    border-top: 1px solid var(--border-subtle);
    border-bottom: 1px solid var(--border-subtle);
  }
  .features__grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 20px;
  }
  @media(max-width: 1024px) { .features__grid { grid-template-columns: repeat(2, 1fr); } }
  @media(max-width: 600px)  { .features__grid { grid-template-columns: 1fr; } }

  .feature-card {
    padding: 28px 24px;
    background: var(--bg-warm);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    transition: var(--transition);
  }
  .feature-card:hover {
    border-color: var(--border-hover);
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
  }
  .feature-card__icon {
    width: 44px; height: 44px;
    border-radius: var(--radius-md);
    display: flex; align-items: center; justify-content: center;
    font-size: 22px;
    margin-bottom: 16px;
  }
  .feature-card__title {
    font-size: 16px;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 8px;
  }
  .feature-card__desc {
    font-size: 13.5px;
    color: var(--text-secondary);
    line-height: 1.65;
  }

  /* ═══ CITIES ═══ */
  .cities {
    padding: 64px 0;
  }
  .cities__grid {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .city-chip {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 18px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-full);
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    transition: var(--transition);
    box-shadow: var(--shadow-xs);
  }
  .city-chip:hover {
    border-color: var(--primary);
    background: var(--primary-50);
    color: var(--primary-dark);
    box-shadow: var(--shadow-sm);
    transform: translateY(-1px);
  }
  .city-chip__emoji { font-size: 18px; }
  .city-chip__arrow {
    color: var(--text-muted);
    transition: var(--transition);
  }
  .city-chip:hover .city-chip__arrow { color: var(--primary); transform: translateX(2px); }

  /* ═══ LATEST ROOMS ═══ */
  .latest {
    padding: 64px 0;
    background: var(--bg-surface);
    border-top: 1px solid var(--border-subtle);
  }
  .latest__grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
  }
  @media(max-width: 1024px) { .latest__grid { grid-template-columns: repeat(2, 1fr); } }
  @media(max-width: 600px)  { .latest__grid { grid-template-columns: 1fr; } }

  .latest__skeleton-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
  }
  @media(max-width: 1024px) { .latest__skeleton-grid { grid-template-columns: repeat(2, 1fr); } }
  @media(max-width: 600px)  { .latest__skeleton-grid { grid-template-columns: 1fr; } }

  .room-skeleton {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }
  .room-skeleton__img {
    aspect-ratio: 16/10;
    background: linear-gradient(90deg, var(--bg-hover) 25%, var(--border) 50%, var(--bg-hover) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }
  .room-skeleton__body { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
  .room-skeleton__line {
    height: 12px;
    border-radius: 6px;
    background: linear-gradient(90deg, var(--bg-hover) 25%, var(--border) 50%, var(--bg-hover) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }
  .room-skeleton__line.w80 { width: 80%; }
  .room-skeleton__line.w60 { width: 60%; }
  .room-skeleton__line.w40 { width: 40%; }

  .room-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    transition: var(--transition);
    display: flex;
    flex-direction: column;
  }
  .room-card:hover {
    border-color: var(--border-hover);
    box-shadow: var(--shadow-card-hover);
    transform: translateY(-3px);
  }

  .room-card__img-wrap {
    position: relative;
    aspect-ratio: 16/10;
    overflow: hidden;
    background: var(--bg-inset);
  }
  .room-card__img {
    width: 100%; height: 100%;
    object-fit: cover;
    transition: transform .4s var(--ease-out);
  }
  .room-card:hover .room-card__img { transform: scale(1.04); }
  .room-card__img-placeholder {
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    font-size: 40px; color: var(--text-muted);
  }
  .room-card__price-tag {
    position: absolute;
    bottom: 10px; left: 10px;
    background: rgba(26,35,50,.85);
    backdrop-filter: blur(8px);
    color: #fff;
    padding: 5px 12px;
    border-radius: var(--radius-sm);
    font-size: 14px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .room-card__price-tag span {
    font-weight: 400;
    font-size: 12px;
    opacity: .7;
    margin-left: 2px;
  }

  .room-card__body {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
  }
  .room-card__title {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .room-card__location {
    font-size: 13px;
    color: var(--text-muted);
  }
  .room-card__meta {
    display: flex;
    gap: 12px;
    margin-top: auto;
    padding-top: 8px;
    font-size: 12px;
    color: var(--text-muted);
  }

  .latest__empty {
    text-align: center;
    padding: 64px 24px;
    background: var(--bg-warm);
    border: 1px dashed var(--border);
    border-radius: var(--radius-xl);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  .latest__empty span { font-size: 48px; }
  .latest__empty p { color: var(--text-secondary); font-size: 15px; }

  .latest__cta {
    display: flex;
    justify-content: center;
    margin-top: 36px;
  }

  /* ═══ CTA SECTION ═══ */
  .cta-section {
    padding: 64px 0;
  }
  .cta-card {
    display: flex;
    align-items: center;
    gap: 40px;
    padding: 48px;
    background: linear-gradient(135deg, var(--primary) 0%, #0f766e 100%);
    border-radius: var(--radius-xl);
    overflow: hidden;
    position: relative;
  }
  .cta-card::before {
    content: '';
    position: absolute;
    top: -60px; right: -60px;
    width: 200px; height: 200px;
    border-radius: 50%;
    background: rgba(255,255,255,.08);
  }
  .cta-card__content { flex: 1; position: relative; z-index: 1; }
  .cta-card__title {
    font-size: 26px;
    font-weight: 800;
    color: #fff;
    margin-bottom: 12px;
  }
  .cta-card__desc {
    font-size: 15px;
    color: rgba(255,255,255,.8);
    line-height: 1.65;
    max-width: 420px;
    margin-bottom: 24px;
  }
  .cta-card__actions { display: flex; gap: 12px; flex-wrap: wrap; }
  .cta-card__visual {
    font-size: 80px;
    flex-shrink: 0;
    opacity: .3;
    animation: float 4s ease-in-out infinite;
  }
  @media(max-width: 768px) {
    .cta-card { flex-direction: column; padding: 36px 24px; text-align: center; }
    .cta-card__actions { justify-content: center; }
    .cta-card__visual { display: none; }
    .cta-card__desc { max-width: none; }
  }

  /* ═══ FOOTER ═══ */
  .footer {
    padding: 40px 0;
    background: var(--bg-warm);
    border-top: 1px solid var(--border);
  }
  .footer__inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 20px;
  }
  .footer__brand {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .footer__logo-mark {
    width: 32px; height: 32px;
    border-radius: 8px;
    background: var(--primary);
    color: #fff;
    font-weight: 800;
    font-size: 16px;
    display: flex; align-items: center; justify-content: center;
  }
  .footer__logo-text {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-primary);
  }
  .footer__tagline {
    font-size: 12px;
    color: var(--text-muted);
  }
  .footer__links {
    display: flex;
    gap: 24px;
    font-size: 13px;
    color: var(--text-secondary);
  }
  .footer__links a:hover { color: var(--primary); }
  .footer__copy {
    font-size: 12px;
    color: var(--text-muted);
  }
  @media(max-width: 600px) {
    .footer__inner { flex-direction: column; text-align: center; }
  }
`;

export default Home;
