import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import apiClient from '../../api/apiClient';
import { roomService } from '../../services/roomService';
import { formatCurrency, formatDate } from '../../utils/format';

const STATUS_TABS = [
  { value: '', label: 'Tất cả' },
  { value: 'pending', label: '⏳ Chờ duyệt' },
  { value: 'approved', label: '✅ Đã duyệt' },
  { value: 'rejected', label: '❌ Từ chối' },
];

const INVENTORY_FILTERS = [
  { value: '', label: 'Tat ca hien trang' },
  { value: 'available', label: 'Con slot' },
  { value: 'occupied', label: 'Dang co nguoi o' },
  { value: 'full', label: 'Het cho' },
  { value: 'vacant', label: 'Trong hoan toan' },
  { value: 'broker_assigned', label: 'Da gan moi gioi' },
  { value: 'broker_unassigned', label: 'Chua gan moi gioi' },
];

const PAGE_SIZE = 10;

const getRoomInventory = (room) => {
  const capacity = Math.max(Number(room.max_occupants) || 0, 0);
  const availableSlots = Math.max(Number(room.available_slots) || 0, 0);
  const currentOccupants = capacity > 0 ? Math.max(capacity - availableSlots, 0) : 0;
  const isFull = room.status === 'approved' && (room.is_available === false || availableSlots <= 0);

  if (isFull) {
    return { label: 'Het cho', tone: 'danger', detail: `${currentOccupants || capacity || 0}/${capacity || currentOccupants || 0} nguoi` };
  }
  if (currentOccupants > 0) {
    return { label: 'Dang co nguoi o', tone: 'info', detail: `${currentOccupants}/${capacity} nguoi, con ${availableSlots} slot` };
  }
  if (room.status === 'approved' && availableSlots > 0) {
    return { label: 'Con slot', tone: 'success', detail: capacity ? `0/${capacity} nguoi, con ${availableSlots} slot` : `Con ${availableSlots} slot` };
  }
  return { label: 'Chua mo phong', tone: 'muted', detail: `${availableSlots} slot` };
};

const AdminAllRooms = () => {
  const [searchParams] = useSearchParams();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [inventory, setInventory] = useState(searchParams.get('inventory') || '');
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [actionState, setActionState] = useState({});
  const [rejectModal, setRejectModal] = useState(null);
  const [brokers, setBrokers] = useState([]);

  const fetchRooms = async (p = 1) => {
    setLoading(true);
    try {
      const params = { page: p, limit: PAGE_SIZE };
      if (status) params.status = status;
      if (inventory) params.inventory = inventory;
      if (search.trim()) params.search = search.trim();
      const { data } = await apiClient.get('/admin/rooms', { params });
      setRooms(data.rooms || []);
      setTotal(data.total || 0);
      setPage(p);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchRooms(1); }, [status, inventory, search]);

  useEffect(() => {
    setStatus(searchParams.get('status') || '');
    setInventory(searchParams.get('inventory') || '');
  }, [searchParams]);

  useEffect(() => {
    const fetchBrokers = async () => {
      try {
        const { data } = await apiClient.get('/admin/brokers');
        setBrokers(data || []);
      } catch (e) { console.error(e); }
    };
    fetchBrokers();
  }, []);

  const handleApprove = async (id) => {
    setActionState(s => ({ ...s, [id]: { loading: true } }));
    try {
      await roomService.updateRoomStatus(id, 'approved');
      fetchRooms(page);
    } catch { setActionState(s => ({ ...s, [id]: { error: 'Lỗi' } })); }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    const { roomId, reason } = rejectModal;
    if (!reason.trim()) {
      setRejectModal(m => ({ ...m, error: 'Vui long nhap ly do tu choi.' }));
      return;
    }
    setActionState(s => ({ ...s, [roomId]: { loading: true } }));
    try {
      await roomService.updateRoomStatus(roomId, 'rejected', reason.trim());
      setRejectModal(null);
      fetchRooms(page);
    } catch {
      setActionState(s => ({ ...s, [roomId]: { error: 'Loi tu choi' } }));
      setRejectModal(null);
    }
  };

  const handleBrokerChange = async (roomId, brokerId) => {
    setActionState(s => ({ ...s, [roomId]: { loading: true } }));
    try {
      const { data } = await apiClient.patch(`/admin/rooms/${roomId}/broker`, {
        broker_id: brokerId || null,
      });
      setRooms(prev => prev.map(room => (
        room.id === roomId
          ? { ...room, broker_id: data.room?.broker_id || null, broker: data.room?.broker || null }
          : room
      )));
    } catch (e) {
      setActionState(s => ({ ...s, [roomId]: { error: e.response?.data?.error || 'Loi gan moi gioi' } }));
    } finally {
      setActionState(s => ({ ...s, [roomId]: { loading: false } }));
    }
  };

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const showingFrom = total === 0 ? 0 : ((page - 1) * PAGE_SIZE) + 1;
  const showingTo = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="admin-allrooms">
      {rejectModal && (
        <div className="modal-overlay" onClick={() => setRejectModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3>Tu choi phong</h3>
            <p>Nhap ly do bat buoc de chu nha biet can sua gi.</p>
            <textarea
              className="form-input"
              rows={3}
              value={rejectModal.reason}
              onChange={e => setRejectModal(m => ({ ...m, reason: e.target.value, error: '' }))}
              placeholder="VD: Anh khong ro, thieu dia chi, noi dung sai quy dinh..."
            />
            {rejectModal.error && <p className="form-error">{rejectModal.error}</p>}
            <div className="modal-actions">
              <button className="btn btn-danger" onClick={handleReject}>Xac nhan tu choi</button>
              <button className="btn btn-ghost" onClick={() => setRejectModal(null)}>Huy</button>
            </div>
          </div>
        </div>
      )}

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

      <div className="ar-inventory-tabs">
        {INVENTORY_FILTERS.map(filter => (
          <button
            key={filter.value}
            className={`ar-inventory-tab ${inventory === filter.value ? 'active' : ''}`}
            onClick={() => setInventory(filter.value)}
          >
            {filter.label}
          </button>
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
        <>
          <div className="rooms-table-wrap">
            <table className="rooms-table">
              <thead>
                <tr>
                  <th>Phòng</th>
                  <th>Chủ nhà</th>
                  <th>Giá / slot</th>
                  <th>Môi giới</th>
                  <th>Trạng thái</th>
                  <th>Ngày đăng</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map(room => {
                  const inventoryState = getRoomInventory(room);
                  return (
                    <tr key={room.id}>
                      <td className="room-title-cell">
                        <strong>{room.title}</strong>
                        <span>{room.address}, {room.city}</span>
                        {room.area && <small>{room.area} m2</small>}
                        {room.rejection_reason && <small>Ly do tu choi: {room.rejection_reason}</small>}
                      </td>
                      <td>
                        <strong className="table-person">{room.users?.full_name || 'Chua cap nhat'}</strong>
                        <span className="table-muted">{room.users?.email || '-'}</span>
                      </td>
                      <td>
                        <strong>{formatCurrency(room.price)}</strong>
                        <span className={`room-inventory-chip room-inventory-chip--${inventoryState.tone}`}>
                          {inventoryState.label}
                          <small>{inventoryState.detail}</small>
                        </span>
                      </td>
                      <td>
                        <select
                          className="broker-select"
                          value={room.broker_id || ''}
                          disabled={actionState[room.id]?.loading}
                          onChange={e => handleBrokerChange(room.id, e.target.value)}
                        >
                          <option value="">Chua phan cong</option>
                          {brokers.map(broker => (
                            <option key={broker.id} value={broker.id}>
                              {broker.full_name} ({broker.email})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <div className="room-state-row">
                          <span className={`badge badge-${room.status}`}>
                            {room.status === 'approved' ? 'Da duyet' : room.status === 'pending' ? 'Cho duyet' : 'Tu choi'}
                          </span>
                          {room.is_hidden && <span className="badge badge-soft-warning">An</span>}
                          {!room.is_available && <span className="badge badge-soft-danger">Het phong</span>}
                        </div>
                        {actionState[room.id]?.error && <p className="form-error">{actionState[room.id].error}</p>}
                      </td>
                      <td>{formatDate(room.created_at)}</td>
                      <td>
                        <div className="table-actions">
                          <Link to={`/rooms/${room.id}`} className="btn btn-ghost btn-sm">
                            Xem
                          </Link>
                          {room.status !== 'approved' && (
                            <button className="btn btn-sm btn-approve-soft" disabled={actionState[room.id]?.loading} onClick={() => handleApprove(room.id)}>
                              Duyet
                            </button>
                          )}
                          {room.status !== 'rejected' && (
                            <button className="btn btn-danger btn-sm" disabled={actionState[room.id]?.loading} onClick={() => setRejectModal({ roomId: room.id, reason: '' })}>
                              Tu choi
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="table-pagination">
            <span>Hien thi {showingFrom}-{showingTo} / {total} phong</span>
            <div>
              <button className="btn btn-ghost btn-sm" disabled={page <= 1 || loading} onClick={() => fetchRooms(page - 1)}>
                Truoc
              </button>
              <strong>Trang {page}/{totalPages}</strong>
              <button className="btn btn-ghost btn-sm" disabled={page >= totalPages || loading} onClick={() => fetchRooms(page + 1)}>
                Sau
              </button>
            </div>
          </div>
        </>
      )}

      <style>{`
        .admin-allrooms { padding: 20px 0; }
        .ar-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
        .ar-header h2 { font-size: 22px; font-weight: 800; color: var(--text-primary); }
        .ar-tabs { display: flex; gap: 6px; margin-bottom: 16px; flex-wrap: wrap; }
        .ar-tab { padding: 7px 16px; border-radius: var(--radius-full); border: 1px solid var(--border); background: transparent; font-size: 13px; font-weight: 500; color: var(--text-secondary); cursor: pointer; transition: var(--transition); font-family: inherit; }
        .ar-tab:hover { border-color: var(--border-hover); color: var(--text-primary); }
        .ar-tab.active { background: var(--primary); border-color: var(--primary); color: #fff; font-weight: 600; }
        .ar-inventory-tabs { display: flex; gap: 6px; flex-wrap: wrap; margin: -6px 0 16px; }
        .ar-inventory-tab { padding: 6px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--bg-surface); color: var(--text-secondary); font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; transition: var(--transition); }
        .ar-inventory-tab:hover { border-color: var(--border-hover); color: var(--text-primary); }
        .ar-inventory-tab.active { background: var(--primary-50); border-color: var(--primary); color: var(--primary-dark); }
        .ar-search { margin-bottom: 20px; max-width: 400px; }
        .ar-loading { display: flex; flex-direction: column; gap: 16px; }
        .modal-overlay { position: fixed; inset: 0; z-index: 200; background: rgba(0,0,0,.4); display: flex; align-items: center; justify-content: center; padding: 20px; }
        .modal-box { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-xl); padding: 28px; max-width: 480px; width: 100%; display: flex; flex-direction: column; gap: 14px; }
        .modal-actions { display: flex; gap: 10px; justify-content: flex-end; }
        .broker-assign { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 10px; color: var(--text-secondary); font-size: 12px; }
        .broker-assign select { min-width: 220px; max-width: 100%; padding: 7px 10px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--bg-surface); color: var(--text-primary); font: inherit; font-size: 12px; }
        .rooms-table-wrap { width: 100%; overflow-x: auto; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--bg-card); }
        .rooms-table { width: 100%; border-collapse: collapse; min-width: 1040px; }
        .rooms-table th { text-align: left; padding: 11px 14px; background: var(--bg-surface); border-bottom: 1px solid var(--border); color: var(--text-muted); font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; }
        .rooms-table td { padding: 13px 14px; border-bottom: 1px solid var(--border-subtle); vertical-align: top; color: var(--text-secondary); font-size: 13px; }
        .rooms-table tr:last-child td { border-bottom: 0; }
        .rooms-table tr:hover td { background: var(--bg-hover); }
        .room-title-cell { min-width: 260px; }
        .room-title-cell strong, .table-person { display: block; color: var(--text-primary); font-weight: 800; margin-bottom: 4px; }
        .room-title-cell span, .room-title-cell small, .table-muted { display: block; color: var(--text-muted); font-size: 12px; line-height: 1.45; }
        .broker-select { min-width: 210px; max-width: 240px; padding: 7px 10px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--bg-surface); color: var(--text-primary); font: inherit; font-size: 12px; }
        .broker-select:disabled { opacity: .65; cursor: wait; }
        .table-actions { display: flex; gap: 6px; flex-wrap: wrap; min-width: 170px; }
        .btn-approve-soft { background: rgba(16,185,129,.12); color: var(--success); border: 1px solid rgba(16,185,129,.28); }
        .badge-soft-warning { background: rgba(245,158,11,.15); color: #d97706; font-size: 11px; }
        .badge-soft-danger { background: rgba(239,68,68,.1); color: #ef4444; font-size: 11px; }
        .table-pagination { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 2px 0; color: var(--text-secondary); font-size: 13px; }
        .table-pagination > div { display: flex; align-items: center; gap: 10px; }
        .table-pagination strong { color: var(--text-primary); font-size: 13px; }
        .room-state-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin-top: 4px; }
        .room-inventory-chip { display: inline-flex; align-items: center; gap: 7px; padding: 4px 9px; border-radius: var(--radius-full); border: 1px solid var(--border); font-size: 11px; font-weight: 800; }
        .room-inventory-chip small { font-size: 11px; font-weight: 600; opacity: .78; }
        .room-inventory-chip--success { background: rgba(16,185,129,.1); color: #047857; border-color: rgba(16,185,129,.24); }
        .room-inventory-chip--info { background: rgba(59,130,246,.1); color: #1d4ed8; border-color: rgba(59,130,246,.22); }
        .room-inventory-chip--danger { background: rgba(239,68,68,.08); color: #dc2626; border-color: rgba(239,68,68,.22); }
        .room-inventory-chip--muted { background: var(--bg-hover); color: var(--text-muted); }
        @media(max-width: 720px) {
          .table-pagination { align-items: flex-start; flex-direction: column; }
        }
      `}</style>
    </div>
  );
};

export default AdminAllRooms;
