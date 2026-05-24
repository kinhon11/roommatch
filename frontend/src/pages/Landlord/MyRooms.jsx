import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { roomService } from '../../services/roomService';
import useFetch from '../../hooks/useFetch';
import { formatCurrency, formatDate } from '../../utils/format';
import { useDialog } from '../../context/DialogContext';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';

const STATUS_MAP = {
  pending: { label: 'Cho duyet', cls: 'badge-pending' },
  approved: { label: 'Da duyet', cls: 'badge-approved' },
  rejected: { label: 'Tu choi', cls: 'badge-rejected' },
};

const PAGE_SIZE = 10;

const MyRooms = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isBroker = user?.role === 'broker';
  const [deletingId, setDeletingId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [toggling, setToggling] = useState({});
  const [page, setPage] = useState(1);
  const dialog = useDialog();
  const toast = useToast();

  const { data: rooms, loading, error, refetch } = useFetch(
    () => roomService.getMyRooms(),
    []
  );

  const roomList = rooms || [];
  const totalPages = Math.max(Math.ceil(roomList.length / PAGE_SIZE), 1);
  const pagedRooms = roomList.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const showingFrom = roomList.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(page * PAGE_SIZE, roomList.length);

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await roomService.deleteRoom(id);
      refetch();
      toast.success('Da xoa phong.');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Xoa phong that bai.');
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  };

  const handleToggleHidden = async (id) => {
    setToggling(s => ({ ...s, [id]: true }));
    try {
      await roomService.toggleRoomHidden(id);
      refetch();
    } catch { /* silent */ }
    finally { setToggling(s => ({ ...s, [id]: false })); }
  };

  const handleToggleAvailable = async (id) => {
    const room = roomList.find(r => r.id === id);
    let slots;
    if (room && !room.is_available) {
      slots = await dialog.prompt({
        title: 'Mo lai phong',
        label: 'So slot con trong',
        defaultValue: String(room.last_available_slots || room.available_slots || 1),
        placeholder: 'Vi du: 1',
        inputType: 'number',
        confirmText: 'Mo phong',
      });
      if (slots === null) return;
      if (!Number.isInteger(Number(slots)) || Number(slots) <= 0) {
        toast.warning('So slot phai la so nguyen lon hon 0.');
        return;
      }
    }
    setToggling(s => ({ ...s, [id]: true }));
    try {
      await roomService.toggleRoomAvailable(id, slots ? Number(slots) : undefined);
      refetch();
      toast.success('Da cap nhat trang thai phong.');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Cap nhat trang thai phong that bai.');
    } finally {
      setToggling(s => ({ ...s, [id]: false }));
    }
  };

  return (
    <div className={`my-rooms-page ${isBroker ? 'my-rooms-page--broker' : ''}`}>
      <div className="container">
        <div className="mr-header animate-slideUp">
          <div>
            <h1>Phong cua toi</h1>
            <p>Quan ly toan bo bai dang phong tro cua ban</p>
          </div>
          <Link to="/landlord/post" id="btn-new-room" className="btn btn-primary">+ Dang tin moi</Link>
        </div>

        {loading && (
          <div className="loading-screen" style={{ minHeight: 300 }}>
            <div className="spinner" /><p>Dang tai...</p>
          </div>
        )}

        {error && <div className="alert alert-error">{error}</div>}

        {!loading && roomList.length === 0 && (
          <div className="mr-empty animate-scaleIn">
            <div className="mr-empty-icon">Nha</div>
            <h3>Ban chua co phong nao</h3>
            <p>Bat dau dang tin phong tro de tiep can nguoi tim phong.</p>
            <Link to="/landlord/post" className="btn btn-primary btn-lg">Dang tin ngay</Link>
          </div>
        )}

        {!loading && roomList.length > 0 && (
          <div className="mr-table-section animate-fadeIn">
            <div className="mr-table-wrap">
              <table className="mr-table">
                <thead>
                  <tr>
                    <th>Phong</th>
                    <th>Gia / slot</th>
                    <th>Trang thai</th>
                    <th>Lich su duyet</th>
                    <th>Ngay dang</th>
                    <th>Thao tac</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRooms.map(room => {
                    const status = STATUS_MAP[room.status] || STATUS_MAP.pending;
                    return (
                      <tr key={room.id}>
                        <td className="mr-room-cell">
                          <strong>{room.title}</strong>
                          <span>{room.address}, {room.city}</span>
                          {room.rejection_reason && <small>Ly do tu choi: {room.rejection_reason}</small>}
                        </td>
                        <td>
                          <strong className="mr-price">{formatCurrency(room.price)}</strong>
                          <span className="mr-muted">{room.area ? `${room.area} m2` : 'Chua cap nhat dien tich'}</span>
                          <span className="mr-muted">Slot: {room.available_slots ?? 0}</span>
                        </td>
                        <td>
                          <div className="mr-state">
                            <span className={`badge ${status.cls}`}>{status.label}</span>
                            {room.is_hidden && <span className="badge badge-hidden">Tam an</span>}
                            {room.status === 'approved' && (
                              <span className={`badge ${room.is_available ? 'badge-approved' : 'badge-rejected'}`}>
                                {room.is_available ? 'Con phong' : 'Het phong'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          {room.room_approval_history?.length > 0 ? (
                            <>
                              <strong className="mr-history">{room.room_approval_history[0].to_status}</strong>
                              {room.room_approval_history[0].reason && <span className="mr-muted">{room.room_approval_history[0].reason}</span>}
                            </>
                          ) : <span className="mr-muted">Chua co</span>}
                        </td>
                        <td>{formatDate(room.created_at)}</td>
                        <td>
                          <div className="mr-table-actions">
                            <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/rooms/${room.id}`)}>Xem</button>
                            <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/landlord/edit/${room.id}`)}>Sua</button>
                            {room.status === 'approved' && (
                              <>
                                <button className="btn btn-sm" onClick={() => handleToggleHidden(room.id)} disabled={toggling[room.id]}>
                                  {room.is_hidden ? 'Hien' : 'An'}
                                </button>
                                <button className="btn btn-sm" onClick={() => handleToggleAvailable(room.id)} disabled={toggling[room.id]}>
                                  {room.is_available ? 'Con phong' : 'Het phong'}
                                </button>
                              </>
                            )}
                            <button className="btn btn-danger btn-sm" onClick={() => setConfirmId(room.id)}>Xoa</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mr-pagination">
              <span>Hien thi {showingFrom}-{showingTo} / {roomList.length} phong</span>
              <div>
                <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(p - 1, 1))}>Truoc</button>
                <strong>Trang {page}/{totalPages}</strong>
                <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(p + 1, totalPages))}>Sau</button>
              </div>
            </div>
          </div>
        )}

        {confirmId && (
          <div className="modal-overlay animate-fadeIn" onClick={() => setConfirmId(null)}>
            <div className="modal animate-scaleIn" onClick={e => e.stopPropagation()}>
              <h3>Xac nhan xoa</h3>
              <p>Ban chac chan muon xoa bai dang nay khong? Hanh dong nay khong the hoan tac.</p>
              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={() => setConfirmId(null)}>Huy</button>
                <button className="btn btn-danger" disabled={deletingId === confirmId} onClick={() => handleDelete(confirmId)}>
                  {deletingId === confirmId ? 'Dang xoa...' : 'Xoa ngay'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{myRoomsStyles}</style>
    </div>
  );
};

const myRoomsStyles = `
  .my-rooms-page { padding:32px 0 80px; }
  .my-rooms-page--broker a[href="/landlord/post"],
  .my-rooms-page--broker .mr-empty a[href="/landlord/post"],
  .my-rooms-page--broker .mr-table-actions .btn-secondary,
  .my-rooms-page--broker .mr-table-actions .btn-danger { display:none; }
  .mr-header { display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;margin-bottom:32px; }
  .mr-header h1 { font-size:28px;font-weight:800;color:var(--text-primary);margin-bottom:6px; }
  .mr-header p { color:var(--text-secondary);font-size:15px; }
  .alert { padding:14px 18px;border-radius:var(--radius-md);font-size:14px;margin-bottom:20px; }
  .alert-error { background:var(--danger-light);color:var(--danger);border:1px solid #fecaca; }
  .mr-empty { text-align:center;padding:80px 40px;background:var(--bg-card);border:1px dashed var(--border);border-radius:var(--radius-xl); }
  .mr-empty-icon { font-size:28px;margin-bottom:16px;color:var(--text-muted); }
  .mr-empty h3 { font-size:22px;font-weight:700;color:var(--text-primary);margin-bottom:10px; }
  .mr-empty p { color:var(--text-secondary);margin-bottom:24px; }
  .mr-table-wrap { width:100%;overflow-x:auto;border:1px solid var(--border);border-radius:var(--radius-md);background:var(--bg-card); }
  .mr-table { width:100%;min-width:980px;border-collapse:collapse; }
  .mr-table th { text-align:left;padding:11px 14px;background:var(--bg-surface);border-bottom:1px solid var(--border);color:var(--text-muted);font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em; }
  .mr-table td { padding:13px 14px;border-bottom:1px solid var(--border-subtle);vertical-align:top;color:var(--text-secondary);font-size:13px; }
  .mr-table tr:last-child td { border-bottom:0; }
  .mr-table tr:hover td { background:var(--bg-hover); }
  .mr-room-cell { min-width:260px; }
  .mr-room-cell strong, .mr-history { display:block;color:var(--text-primary);font-weight:800;margin-bottom:4px; }
  .mr-room-cell span, .mr-room-cell small, .mr-muted { display:block;color:var(--text-muted);font-size:12px;line-height:1.45; }
  .mr-price { display:block;color:var(--primary);font-weight:800;margin-bottom:4px; }
  .mr-state, .mr-table-actions { display:flex;gap:6px;flex-wrap:wrap; }
  .mr-table-actions { min-width:220px; }
  .badge-hidden { background:rgba(245,158,11,.15);color:#d97706;border:1px solid rgba(245,158,11,.3); }
  .mr-pagination { display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 2px 0;color:var(--text-secondary);font-size:13px; }
  .mr-pagination > div { display:flex;align-items:center;gap:10px; }
  .mr-pagination strong { color:var(--text-primary);font-size:13px; }
  .modal-overlay { position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px; }
  .modal { background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-xl);padding:32px;max-width:400px;width:100%; }
  .modal h3 { font-size:20px;font-weight:700;color:var(--text-primary);margin-bottom:12px; }
  .modal p { color:var(--text-secondary);font-size:14px;line-height:1.6;margin-bottom:24px; }
  .modal-actions { display:flex;gap:12px;justify-content:flex-end; }
  @media(max-width:700px){ .mr-pagination{align-items:flex-start;flex-direction:column;} }
`;

export default MyRooms;
