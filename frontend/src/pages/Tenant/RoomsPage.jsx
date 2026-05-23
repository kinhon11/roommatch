import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { roomService } from '../../services/roomService';
import { formatCurrency } from '../../utils/format';
import { supabase } from '../../services/supabaseClient';

const CITIES = ['Tất cả', 'Hà Nội', 'Hồ Chí Minh', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ', 'Huế', 'Nha Trang', 'Biên Hòa', 'Vũng Tàu'];
const SORTS = [
  { value: 'newest',     label: 'Mới nhất' },
  { value: 'price_asc',  label: 'Giá: thấp → cao' },
  { value: 'price_desc', label: 'Giá: cao → thấp' },
];
const PAGE_SIZE = 12;

const RoomsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [city, setCity] = useState(searchParams.get('city') || 'Tất cả');
  const [sort, setSort] = useState(searchParams.get('sort') || 'newest');
  const [priceMin, setPriceMin] = useState(searchParams.get('priceMin') || '');
  const [priceMax, setPriceMax] = useState(searchParams.get('priceMax') || '');
  const [areaMin, setAreaMin] = useState(searchParams.get('areaMin') || '');
  const [areaMax, setAreaMax] = useState(searchParams.get('areaMax') || '');
  const [noOwner, setNoOwner] = useState(searchParams.get('noOwner') === 'true');
  const [privateHours, setPrivateHours] = useState(searchParams.get('privateHours') === 'true');
  const [allowPets, setAllowPets] = useState(searchParams.get('allowPets') === 'true');
  const [hasParking, setHasParking] = useState(searchParams.get('hasParking') === 'true');
  const [selectedAmenities, setSelectedAmenities] = useState(
    searchParams.get('amenities') ? searchParams.get('amenities').split(',') : []
  );
  const [showFilters, setShowFilters] = useState(false);

  // Load amenity list
  const [amenityList, setAmenityList] = useState([]);
  useEffect(() => {
    supabase.from('amenities').select('*').order('name').then(({ data }) => {
      if (data) setAmenityList(data);
    });
  }, []);

  const fetchRooms = useCallback(async (pageNum = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = { sort, page: pageNum, limit: PAGE_SIZE };
      if (search.trim()) params.search = search.trim();
      if (city !== 'Tất cả') params.city = city;
      if (priceMin) params.price_min = +priceMin;
      if (priceMax) params.price_max = +priceMax;
      if (areaMin) params.area_min = +areaMin;
      if (areaMax) params.area_max = +areaMax;
      if (noOwner) params.no_owner = 'true';
      if (privateHours) params.private_hours = 'true';
      if (allowPets) params.allow_pets = 'true';
      if (hasParking) params.has_parking = 'true';
      if (selectedAmenities.length > 0) params.amenities = selectedAmenities.join(',');

      const data = await roomService.getApprovedRooms(params);
      if (pageNum === 1) {
        setRooms(Array.isArray(data?.rooms) ? data.rooms : []);
      } else {
        setRooms(prev => [...prev, ...(Array.isArray(data?.rooms) ? data.rooms : [])]);
      }
      setTotal(data?.total || 0);
      setPage(pageNum);
    } catch {
      setError('Không thể tải danh sách phòng.');
      if (pageNum === 1) setRooms([]);
    } finally {
      setLoading(false);
    }
  }, [search, city, sort, priceMin, priceMax, areaMin, areaMax, noOwner, privateHours, allowPets, hasParking, selectedAmenities]);

  useEffect(() => { fetchRooms(1); }, [fetchRooms]);

  // Sync to URL
  useEffect(() => {
    const p = {};
    if (search.trim()) p.q = search;
    if (city !== 'Tất cả') p.city = city;
    if (sort !== 'newest') p.sort = sort;
    if (priceMin) p.priceMin = priceMin;
    if (priceMax) p.priceMax = priceMax;
    if (areaMin) p.areaMin = areaMin;
    if (areaMax) p.areaMax = areaMax;
    if (noOwner) p.noOwner = 'true';
    if (privateHours) p.privateHours = 'true';
    if (allowPets) p.allowPets = 'true';
    if (hasParking) p.hasParking = 'true';
    if (selectedAmenities.length > 0) p.amenities = selectedAmenities.join(',');
    setSearchParams(p, { replace: true });
  }, [search, city, sort, priceMin, priceMax, areaMin, areaMax, noOwner, privateHours, allowPets, hasParking, selectedAmenities, setSearchParams]);

  const clearFilters = () => {
    setSearch('');
    setCity('Tất cả');
    setSort('newest');
    setPriceMin('');
    setPriceMax('');
    setAreaMin('');
    setAreaMax('');
    setNoOwner(false);
    setPrivateHours(false);
    setAllowPets(false);
    setHasParking(false);
    setSelectedAmenities([]);
  };

  const toggleAmenity = (name) => {
    setSelectedAmenities(prev =>
      prev.includes(name) ? prev.filter(a => a !== name) : [...prev, name]
    );
  };

  const hasActiveFilters = search || city !== 'Tất cả' || priceMin || priceMax || areaMin || areaMax || noOwner || privateHours || allowPets || hasParking || selectedAmenities.length > 0;
  const hasMore = rooms.length < total;

  return (
    <div className="rooms-page">
      <div className="container">

        {/* ── Header ── */}
        <div className="rooms-header animate-slideUp">
          <div>
            <h1 className="rooms-header__title">Tìm phòng trọ</h1>
            <p className="rooms-header__sub">
              {loading && page === 1 ? 'Đang tìm kiếm...' : `${total} phòng phù hợp`}
            </p>
          </div>
        </div>

        {/* ── Search Bar ── */}
        <div className="rooms-search animate-slideUp" style={{ animationDelay: '.05s' }}>
          <div className="rooms-search__input-wrap">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="rooms-search__icon">
              <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M12.5 12.5L16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              id="search-rooms"
              className="rooms-search__input"
              type="text"
              placeholder="Tìm theo tiêu đề, địa chỉ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="rooms-search__clear" onClick={() => setSearch('')}>✕</button>
            )}
          </div>

          <button
            className={`rooms-filter-btn ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters((v) => !v)}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Bộ lọc
            {hasActiveFilters && <span className="rooms-filter-dot" />}
          </button>

          <select
            className="rooms-sort-select"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            id="sort-rooms"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* ── Expandable Filters ── */}
        {showFilters && (
          <div className="rooms-filters animate-slideDown">
            {/* City */}
            <div className="rooms-filters__group">
              <label className="rooms-filters__label">Thành phố</label>
              <div className="rooms-city-chips">
                {CITIES.map((c) => (
                  <button
                    key={c}
                    className={`rooms-city-chip ${city === c ? 'active' : ''}`}
                    onClick={() => setCity(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Price & Area */}
            <div className="rooms-filters__row">
              <div className="rooms-filters__group">
                <label className="rooms-filters__label">Giá từ (VNĐ)</label>
                <input
                  type="number" className="form-input" placeholder="0"
                  value={priceMin} onChange={(e) => setPriceMin(e.target.value)} min="0"
                />
              </div>
              <div className="rooms-filters__group">
                <label className="rooms-filters__label">Giá đến (VNĐ)</label>
                <input
                  type="number" className="form-input" placeholder="10,000,000"
                  value={priceMax} onChange={(e) => setPriceMax(e.target.value)} min="0"
                />
              </div>
              <div className="rooms-filters__group">
                <label className="rooms-filters__label">Diện tích từ (m²)</label>
                <input
                  type="number" className="form-input" placeholder="10"
                  value={areaMin} onChange={(e) => setAreaMin(e.target.value)} min="0"
                />
              </div>
              <div className="rooms-filters__group">
                <label className="rooms-filters__label">Diện tích đến (m²)</label>
                <input
                  type="number" className="form-input" placeholder="100"
                  value={areaMax} onChange={(e) => setAreaMax(e.target.value)} min="0"
                />
              </div>
            </div>

            {/* Amenities */}
            {amenityList.length > 0 && (
              <div className="rooms-filters__group">
                <label className="rooms-filters__label">Tiện ích</label>
                <div className="rooms-amenity-chips">
                  {amenityList.map((a) => (
                    <button
                      key={a.id}
                      className={`rooms-amenity-chip ${selectedAmenities.includes(a.name) ? 'active' : ''}`}
                      onClick={() => toggleAmenity(a.name)}
                    >
                      {selectedAmenities.includes(a.name) ? '✅' : '⬜'} {a.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Has Slots + Clear */}
            <div className="rooms-filters__row" style={{ alignItems: 'center' }}>
              <label className="rooms-slot-toggle">
                <input type="checkbox" checked={noOwner} onChange={(e) => setNoOwner(e.target.checked)} />
                <span>Không chung chủ</span>
              </label>
              <label className="rooms-slot-toggle">
                <input type="checkbox" checked={privateHours} onChange={(e) => setPrivateHours(e.target.checked)} />
                <span>Giờ giấc tự do</span>
              </label>
              <label className="rooms-slot-toggle">
                <input type="checkbox" checked={allowPets} onChange={(e) => setAllowPets(e.target.checked)} />
                <span>Cho nuôi thú cưng</span>
              </label>
              <label className="rooms-slot-toggle">
                <input type="checkbox" checked={hasParking} onChange={(e) => setHasParking(e.target.checked)} />
                <span>Có chỗ để xe</span>
              </label>

              {hasActiveFilters && (
                <button className="btn btn-ghost btn-sm" onClick={clearFilters} style={{ marginLeft: 'auto' }}>
                  ✕ Xóa bộ lọc
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Room List ── */}
        {loading && page === 1 ? (
          <div className="rooms-grid">
            {[1, 2, 3, 4, 5, 6].map((i) => (
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
        ) : error ? (
          <div className="rooms-empty">
            <span>⚠️</span>
            <h3>Đã xảy ra lỗi</h3>
            <p>{error}</p>
            <button className="btn btn-primary btn-sm" onClick={() => fetchRooms(1)}>Thử lại</button>
          </div>
        ) : rooms.length === 0 ? (
          <div className="rooms-empty animate-scaleIn">
            <span>🔍</span>
            <h3>Không tìm thấy phòng</h3>
            <p>Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
            {hasActiveFilters && (
              <button className="btn btn-secondary btn-sm" onClick={clearFilters}>Xóa bộ lọc</button>
            )}
          </div>
        ) : (
          <>
            <div className="rooms-grid animate-fadeIn">
              {rooms.map((room, i) => {
                const img = room.room_images?.find((x) => x.is_primary) || room.room_images?.[0];
                const amenities = room.room_amenities?.map(ra => ra.amenities?.name).filter(Boolean) || [];
                return (
                  <Link
                    key={room.id}
                    to={`/rooms/${room.id}`}
                    className="room-card animate-slideUp"
                    style={{ animationDelay: `${Math.min(i * 0.03, 0.3)}s` }}
                  >
                    <div className="room-card__img-wrap">
                      {img ? (
                        <img src={img.image_url} alt={room.title} className="room-card__img" loading="lazy" />
                      ) : (
                        <div className="room-card__img-placeholder">🏠</div>
                      )}
                      <div className="room-card__price-tag">
                        {formatCurrency(room.price)}<span>/tháng</span>
                      </div>
                      {!room.is_available && (
                        <div className="room-card__badge room-card__badge--full">Hết phòng</div>
                      )}
                    </div>
                    <div className="room-card__body">
                      <h3 className="room-card__title">{room.title}</h3>
                      <p className="room-card__location">📍 {room.address}, {room.city}</p>
                      <div className="room-card__meta">
                        {room.area && <span>📐 {room.area} m²</span>}
                        {room.available_slots > 0 && <span>👥 {room.available_slots} chỗ</span>}
                        {room.deposit_amount && <span>💰 Cọc {formatCurrency(room.deposit_amount)}</span>}
                      </div>
                      <div className="room-card__rule-tags">
                        {!room.is_owner_occupied && <span>Không chung chủ</span>}
                        {room.has_private_hours && <span>Giờ tự do</span>}
                        {room.has_parking && <span>Có xe</span>}
                        {room.allow_pets && <span>Pet-friendly</span>}
                      </div>
                      {amenities.length > 0 && (
                        <div className="room-card__amenities">
                          {amenities.slice(0, 3).map(name => (
                            <span key={name} className="room-card__amenity-tag">{name}</span>
                          ))}
                          {amenities.length > 3 && (
                            <span className="room-card__amenity-tag room-card__amenity-more">+{amenities.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Load more */}
            {hasMore && (
              <div className="rooms-load-more">
                <button
                  className="btn btn-secondary btn-lg"
                  onClick={() => fetchRooms(page + 1)}
                  disabled={loading}
                >
                  {loading ? 'Đang tải...' : `Xem thêm (${rooms.length}/${total})`}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <style>{roomsStyles}</style>
    </div>
  );
};

const roomsStyles = `
  .rooms-page { padding: 32px 0 80px; }

  .rooms-header { margin-bottom: 24px; }
  .rooms-header__title {
    font-size: 26px; font-weight: 800;
    color: var(--text-primary); margin-bottom: 4px;
  }
  .rooms-header__sub { font-size: 14px; color: var(--text-secondary); }

  /* Search bar */
  .rooms-search {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
    align-items: stretch;
  }
  .rooms-search__input-wrap {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
  }
  .rooms-search__icon {
    position: absolute; left: 14px;
    color: var(--text-muted); pointer-events: none;
  }
  .rooms-search__input {
    width: 100%;
    padding: 11px 40px 11px 42px;
    background: var(--bg-card);
    border: 1.5px solid var(--border);
    border-radius: var(--radius-md);
    font-size: 14px;
    color: var(--text-primary);
    transition: var(--transition);
    outline: none;
    font-family: inherit;
  }
  .rooms-search__input:focus {
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(13,148,136,.08);
  }
  .rooms-search__input::placeholder { color: var(--text-muted); }
  .rooms-search__clear {
    position: absolute; right: 12px;
    background: var(--bg-hover); border: none;
    width: 22px; height: 22px; border-radius: 50%;
    font-size: 11px; cursor: pointer; color: var(--text-muted);
    display: flex; align-items: center; justify-content: center;
    transition: var(--transition);
  }
  .rooms-search__clear:hover { background: var(--border); color: var(--text-primary); }

  .rooms-filter-btn {
    display: flex; align-items: center; gap: 6px;
    padding: 10px 16px;
    background: var(--bg-card);
    border: 1.5px solid var(--border);
    border-radius: var(--radius-md);
    font-size: 13px; font-weight: 500;
    color: var(--text-secondary);
    cursor: pointer; transition: var(--transition);
    white-space: nowrap;
    position: relative;
    font-family: inherit;
  }
  .rooms-filter-btn:hover { border-color: var(--border-hover); color: var(--text-primary); }
  .rooms-filter-btn.active { border-color: var(--primary); color: var(--primary-dark); background: var(--primary-50); }
  .rooms-filter-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--primary);
    position: absolute; top: 8px; right: 8px;
  }

  .rooms-sort-select {
    padding: 10px 14px;
    background: var(--bg-card);
    border: 1.5px solid var(--border);
    border-radius: var(--radius-md);
    font-size: 13px; color: var(--text-secondary);
    cursor: pointer; outline: none;
    transition: var(--transition);
    font-family: inherit;
  }
  .rooms-sort-select:focus { border-color: var(--primary); }

  /* Filters panel */
  .rooms-filters {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 20px;
    margin-bottom: 24px;
    display: flex; flex-direction: column; gap: 16px;
  }
  .rooms-filters__label {
    font-size: 12px; font-weight: 600;
    color: var(--text-muted); text-transform: uppercase;
    letter-spacing: .04em; margin-bottom: 8px; display: block;
  }
  .rooms-filters__row {
    display: flex; gap: 12px; flex-wrap: wrap; align-items: flex-end;
  }
  .rooms-filters__row .rooms-filters__group { flex: 1; min-width: 140px; }

  .rooms-city-chips {
    display: flex; flex-wrap: wrap; gap: 6px;
  }
  .rooms-city-chip {
    padding: 6px 14px;
    border-radius: var(--radius-full);
    border: 1px solid var(--border);
    background: transparent;
    font-size: 13px; font-weight: 500;
    color: var(--text-secondary);
    cursor: pointer; transition: var(--transition);
    font-family: inherit;
  }
  .rooms-city-chip:hover { border-color: var(--border-hover); color: var(--text-primary); }
  .rooms-city-chip.active {
    background: var(--primary);
    border-color: var(--primary);
    color: #fff; font-weight: 600;
  }

  /* Amenity chips */
  .rooms-amenity-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .rooms-amenity-chip {
    padding: 6px 12px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    background: transparent;
    font-size: 12px; font-weight: 500;
    color: var(--text-secondary);
    cursor: pointer; transition: var(--transition);
    font-family: inherit;
  }
  .rooms-amenity-chip:hover { border-color: var(--border-hover); color: var(--text-primary); }
  .rooms-amenity-chip.active {
    background: var(--primary-50);
    border-color: var(--primary);
    color: var(--primary-dark); font-weight: 600;
  }

  /* Slot toggle */
  .rooms-slot-toggle {
    display: flex; align-items: center; gap: 8px;
    font-size: 13px; color: var(--text-secondary);
    cursor: pointer; font-weight: 500;
  }
  .rooms-slot-toggle input[type="checkbox"] {
    width: 16px; height: 16px; accent-color: var(--primary);
    cursor: pointer;
  }

  /* Room grid */
  .rooms-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
  }
  @media(max-width: 1024px) { .rooms-grid { grid-template-columns: repeat(2, 1fr); } }
  @media(max-width: 600px)  { .rooms-grid { grid-template-columns: 1fr; } }

  /* Room card */
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
  .room-card__price-tag span { font-weight: 400; font-size: 12px; opacity: .7; margin-left: 2px; }
  .room-card__badge {
    position: absolute; top: 10px; right: 10px;
    padding: 3px 10px; border-radius: var(--radius-full);
    font-size: 11px; font-weight: 700;
  }
  .room-card__badge--full {
    background: rgba(239,68,68,.9); color: #fff;
  }
  .room-card__body {
    padding: 16px;
    display: flex; flex-direction: column; gap: 6px; flex: 1;
  }
  .room-card__title {
    font-size: 15px; font-weight: 600;
    color: var(--text-primary); line-height: 1.4;
    display: -webkit-box; -webkit-line-clamp: 2;
    -webkit-box-orient: vertical; overflow: hidden;
  }
  .room-card__location { font-size: 13px; color: var(--text-muted); }
  .room-card__meta {
    display: flex; gap: 12px; margin-top: auto;
    padding-top: 8px; font-size: 12px; color: var(--text-muted);
  }
  .room-card__amenities {
    display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px;
  }
  .room-card__rule-tags {
    display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px;
  }
  .room-card__rule-tags span {
    padding: 3px 8px; border-radius: var(--radius-full);
    background: var(--bg-warm); border: 1px solid var(--border-subtle);
    font-size: 11px; color: var(--text-secondary); font-weight: 600;
  }
  .room-card__amenity-tag {
    padding: 2px 8px; border-radius: var(--radius-full);
    background: var(--bg-surface); border: 1px solid var(--border-subtle);
    font-size: 11px; color: var(--text-muted); font-weight: 500;
  }
  .room-card__amenity-more {
    background: var(--primary-50); color: var(--primary-dark);
    border-color: var(--primary-100);
  }

  /* Skeleton */
  .room-skeleton {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }
  .room-skeleton__img {
    aspect-ratio: 16/10;
    background: linear-gradient(90deg, var(--bg-hover) 25%, var(--border) 50%, var(--bg-hover) 75%);
    background-size: 200% 100%; animation: shimmer 1.5s infinite;
  }
  .room-skeleton__body { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
  .room-skeleton__line {
    height: 12px; border-radius: 6px;
    background: linear-gradient(90deg, var(--bg-hover) 25%, var(--border) 50%, var(--bg-hover) 75%);
    background-size: 200% 100%; animation: shimmer 1.5s infinite;
  }
  .room-skeleton__line.w80 { width: 80%; }
  .room-skeleton__line.w60 { width: 60%; }
  .room-skeleton__line.w40 { width: 40%; }

  /* Empty */
  .rooms-empty {
    text-align: center;
    padding: 80px 24px;
    background: var(--bg-card);
    border: 1px dashed var(--border);
    border-radius: var(--radius-xl);
    display: flex; flex-direction: column;
    align-items: center; gap: 12px;
  }
  .rooms-empty span { font-size: 48px; }
  .rooms-empty h3 { font-size: 20px; font-weight: 700; color: var(--text-primary); }
  .rooms-empty p { color: var(--text-secondary); font-size: 14px; }

  /* Load more */
  .rooms-load-more {
    display: flex; justify-content: center;
    margin-top: 32px;
  }

  @media(max-width: 640px) {
    .rooms-search { flex-wrap: wrap; }
    .rooms-sort-select { flex: 1; }
  }
`;

export default RoomsPage;
