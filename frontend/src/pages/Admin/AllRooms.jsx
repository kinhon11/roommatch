import { useState, useEffect } from 'react';
import apiClient from '../../api/apiClient';
import { roomService } from '../../services/roomService';
import { formatCurrency, formatDate } from '../../utils/format';

const STATUS_TABS = [
  { value: '', label: 'Tất cả' },
  { value: 'pending', label: '⏳ Chờ duyệt' },
  { value: 'approved', label: '✅ Đã duyệt' },
  { value: 'rejected', label: '❌ Từ chối' },
];

const AdminAllRooms = () => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [actionState, setActionState] = useState({});

  const fetchRooms = async (p = 1) => {
    setLoading(true);
    try {
      const params = { page: p, limit: 20 };
      if (status) params.status = status;
      if (search.trim()) params.search = search.trim();
      const { data } = await apiClient.get('/admin/rooms', { params });
      setRooms(data.rooms || []);
      setTotal(data.total || 0);
      setPage(p);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchRooms(1); }, [status, search]);

  const handleApprove = async (id) => {
    setActionState(s => ({ ...s, [id]: { loading: true } }));
    try {
      await roomService.updateRoomStatus(id, 'approved');
      fetchRooms(page);
    } catch { setActionState(s => ({ ...s, [id]: { error: 'Lỗi' } })); }
  };

  const handleReject = async (id) => {
    setActionState(s => ({ ...s, [id]: { loading: true } }));
    try {
      await roomService.updateRoomStatus(id, 'rejected');
      fetchRooms(page);
    } catch { setActionState(s => ({ ...s, [id]: { error: 'Lỗi' } })); }
  };

  const primaryImg = (rm) =>
    rm.room_images?.find(i => i.is_primary)?.image_url || rm.room_images?.[0]?.image_url || null;

  const hasMore = rooms.length < total && rooms.length === 20;

  return (
    <div className="admin-allrooms">
      <div className="ar-header">
        <h2>🏠 Tất cả phòng</h2>
        <span className="badge badge-admin">{total} phòng</span>
      </div>

      {/* Tabs */}
      <div className="ar-tabs">
        {STATUS_TABS.map(t => (
          <button
            key={t.value}
            className={`ar-tab ${status === t.value ? 'active' : ''}`}
            onClick={() => setStatus(t.value)}
          >{t.label}</button>
        ))}
      </div>

      {/* Search */}
      <div className="ar-search">
        <input
          className="form-input"
          placeholder="🔍 Tìm theo tiêu đề, địa chỉ..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="ar-loading">
          {[1,2,3].map(i => <div key={i} className="pending-skeleton" />)}
        </div>
      ) : rooms.length === 0 ? (
        <div className="pending-empty"><span>📋</span><p>Không có phòng nào.</p></div>
      ) : (
        <div className="pending-list">
          {rooms.map(room => (
            <div key={room.id} className="pending-card">
              <div className="pending-card__img">
                {primaryImg(room)
                  ? <img src={primaryImg(room)} alt={room.title} />
                  : <div className="pending-card__no-img">🏠</div>}
              </div>
              <div className="pending-card__body">
                <h3 className="pending-card__title">{room.title}</h3>
                <p className="pending-card__meta">
                  📍 {room.address}, {room.city} &nbsp;|&nbsp;
                  💰 {formatCurrency(room.price)}/tháng
                  {room.area && <> &nbsp;|&nbsp; 📐 {room.area} m²</>}
                </p>
                <p className="pending-card__host">
                  👤 {room.users?.full_name} ({room.users?.email})
                </p>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                  <span className={`badge badge-${room.status}`}>
                    {room.status === 'approved' ? '✅ Duyệt' : room.status === 'pending' ? '⏳ Chờ' : '❌ Từ chối'}
                  </span>
                  {room.is_hidden && <span className="badge" style={{ background: 'rgba(245,158,11,.15)', color: '#d97706', fontSize: 11 }}>Ẩn</span>}
                  {!room.is_available && <span className="badge" style={{ background: 'rgba(239,68,68,.1)', color: '#ef4444', fontSize: 11 }}>Hết phòng</span>}
                </div>
                <p className="pending-card__date">📅 {formatDate(room.created_at)}</p>
              </div>
              <div className="pending-card__actions">
                {room.status !== 'approved' && (
                  <button className="btn btn-sm" style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.3)' }}
                    disabled={actionState[room.id]?.loading} onClick={() => handleApprove(room.id)}>
                    ✅ Duyệt
                  </button>
                )}
                {room.status !== 'rejected' && (
                  <button className="btn btn-danger btn-sm"
                    disabled={actionState[room.id]?.loading} onClick={() => handleReject(room.id)}>
                    ❌ Từ chối
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {hasMore && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
          <button className="btn btn-secondary" onClick={() => fetchRooms(page + 1)}>Xem thêm</button>
        </div>
      )}

      <style>{`
        .admin-allrooms { padding: 20px 0; }
        .ar-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
        .ar-header h2 { font-size: 22px; font-weight: 800; color: var(--text-primary); }
        .ar-tabs { display: flex; gap: 6px; margin-bottom: 16px; flex-wrap: wrap; }
        .ar-tab { padding: 7px 16px; border-radius: var(--radius-full); border: 1px solid var(--border); background: transparent; font-size: 13px; font-weight: 500; color: var(--text-secondary); cursor: pointer; transition: var(--transition); font-family: inherit; }
        .ar-tab:hover { border-color: var(--border-hover); color: var(--text-primary); }
        .ar-tab.active { background: var(--primary); border-color: var(--primary); color: #fff; font-weight: 600; }
        .ar-search { margin-bottom: 20px; max-width: 400px; }
        .ar-loading { display: flex; flex-direction: column; gap: 16px; }
      `}</style>
    </div>
  );
};

export default AdminAllRooms;
