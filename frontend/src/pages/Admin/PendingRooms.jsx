import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

import { roomService } from '../../services/roomService';
import apiClient from '../../api/apiClient';
import { formatCurrency as formatPrice, formatDate } from '../../utils/format';

const AdminPendingRooms = () => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionState, setActionState] = useState({}); // { [id]: { loading, error } }
  const [rejectModal, setRejectModal] = useState(null); // { roomId, reason }
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const fetchPending = async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get('/admin/rooms/pending');
      setRooms(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPending(); }, []);

  const handleApprove = async (id) => {
    setActionState(s => ({ ...s, [id]: { loading: true } }));
    try {
      await roomService.updateRoomStatus(id, 'approved');
      setRooms(rs => rs.filter(r => r.id !== id));
    } catch {
      setActionState(s => ({ ...s, [id]: { loading: false, error: 'Lỗi duyệt phòng' } }));
    }
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
      setRooms(rs => rs.filter(r => r.id !== roomId));
      setRejectModal(null);
    } catch {
      setActionState(s => ({ ...s, [roomId]: { loading: false, error: 'Lỗi từ chối' } }));
      setRejectModal(null);
    }
  };

  const totalPages = Math.max(Math.ceil(rooms.length / pageSize), 1);
  const pagedRooms = rooms.slice((page - 1) * pageSize, page * pageSize);
  const showingFrom = rooms.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, rooms.length);

  return (
    <div className="admin-pending-page">
      {/* Reject Modal */}
      {rejectModal && (
        <div className="modal-overlay" onClick={() => setRejectModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3>❌ Từ chối phòng</h3>
            <p>Nhập lý do từ chối để chủ nhà biết cần sửa gì:</p>
            <textarea
              id="reject-reason"
              className="form-input"
              rows={3}
              placeholder="VD: Thiếu thông tin địa chỉ, ảnh không rõ ràng..."
              value={rejectModal.reason}
              onChange={e => setRejectModal(m => ({ ...m, reason: e.target.value }))}
            />
            {rejectModal.error && <p className="form-error">{rejectModal.error}</p>}
            <div className="modal-actions">
              <button id="btn-confirm-reject" className="btn btn-danger" onClick={handleReject}>
                Xác nhận từ chối
              </button>
              <button className="btn btn-ghost" onClick={() => setRejectModal(null)}>Hủy</button>
            </div>
          </div>
        </div>
      )}

      <div className="pending-header">
        <h2>⏳ Phòng chờ duyệt</h2>
        <span className="badge badge-pending">{rooms.length} phòng</span>
      </div>

      {loading ? (
        <div className="pending-loading">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="pending-skeleton" />)}
        </div>
      ) : rooms.length === 0 ? (
        <div className="pending-empty">
          <span>🎉</span>
          <p>Không có phòng nào chờ duyệt!</p>
        </div>
      ) : (
        <>
          <div className="pending-table-wrap">
            <table className="pending-table">
              <thead>
                <tr>
                  <th>Phòng</th>
                  <th>Chủ nhà</th>
                  <th>Giá / diện tích</th>
                  <th>Lần duyệt gần nhất</th>
                  <th>Ngày đăng</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {pagedRooms.map(room => (
                  <tr key={room.id}>
                    <td className="room-title-cell">
                      <strong>{room.title}</strong>
                      <span>{room.address}, {room.city}</span>
                      {room.description && <small>{room.description.slice(0, 90)}{room.description.length > 90 ? '...' : ''}</small>}
                    </td>
                    <td>
                      <strong className="table-person">{room.users?.full_name || 'Chua cap nhat'}</strong>
                      <span className="table-muted">{room.users?.email || '-'}</span>
                    </td>
                    <td>
                      <strong>{formatPrice(room.price)}</strong>
                      <span className="table-muted">{room.area ? `${room.area} m2` : 'Chua cap nhat dien tich'}</span>
                    </td>
                    <td>
                      {room.room_approval_history?.length > 0 ? (
                        <>
                          <strong className="table-person">{room.room_approval_history[0].to_status}</strong>
                          {room.room_approval_history[0].reason && <span className="table-muted">{room.room_approval_history[0].reason}</span>}
                        </>
                      ) : (
                        <span className="table-muted">Chua co</span>
                      )}
                    </td>
                    <td>{formatDate(room.created_at)}</td>
                    <td>
                      {actionState[room.id]?.error && <p className="form-error">{actionState[room.id].error}</p>}
                      <div className="table-actions">
                        <Link to={`/rooms/${room.id}`} className="btn btn-ghost btn-sm">Xem</Link>
                        <button id={`btn-approve-${room.id}`} className="btn btn-sm btn-approve-soft" disabled={actionState[room.id]?.loading} onClick={() => handleApprove(room.id)}>
                          {actionState[room.id]?.loading ? '...' : 'Duyet'}
                        </button>
                        <button id={`btn-reject-${room.id}`} className="btn btn-danger btn-sm" disabled={actionState[room.id]?.loading} onClick={() => setRejectModal({ roomId: room.id, reason: '' })}>
                          Tu choi
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-pagination">
            <span>Hien thi {showingFrom}-{showingTo} / {rooms.length} phong</span>
            <div>
              <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(p - 1, 1))}>Truoc</button>
              <strong>Trang {page}/{totalPages}</strong>
              <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(p + 1, totalPages))}>Sau</button>
            </div>
          </div>
        </>
      )}

      <style>{styles}</style>
    </div>
  );
};

const styles = `
  .admin-pending-page { padding: 20px 0; }
  .pending-header { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
  .pending-header h2 { font-size: 22px; font-weight: 800; color: var(--text-primary); }

  .pending-table-wrap { width: 100%; overflow-x: auto; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--bg-card); }
  .pending-table { width: 100%; min-width: 980px; border-collapse: collapse; }
  .pending-table th { text-align: left; padding: 11px 14px; background: var(--bg-surface); border-bottom: 1px solid var(--border); color: var(--text-muted); font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; }
  .pending-table td { padding: 13px 14px; border-bottom: 1px solid var(--border-subtle); vertical-align: top; color: var(--text-secondary); font-size: 13px; }
  .pending-table tr:last-child td { border-bottom: 0; }
  .pending-table tr:hover td { background: var(--bg-hover); }
  .room-title-cell { min-width: 260px; }
  .room-title-cell strong, .table-person { display: block; color: var(--text-primary); font-weight: 800; margin-bottom: 4px; }
  .room-title-cell span, .room-title-cell small, .table-muted { display: block; color: var(--text-muted); font-size: 12px; line-height: 1.45; }
  .table-actions { display: flex; gap: 6px; flex-wrap: wrap; min-width: 170px; }
  .btn-approve-soft { background: rgba(16,185,129,.12); color: var(--success); border: 1px solid rgba(16,185,129,.28); }
  .table-pagination { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 2px 0; color: var(--text-secondary); font-size: 13px; }
  .table-pagination > div { display: flex; align-items: center; gap: 10px; }
  .table-pagination strong { color: var(--text-primary); font-size: 13px; }
  @media(max-width: 700px) { .table-pagination { align-items: flex-start; flex-direction: column; } }

  .pending-loading { display: flex; flex-direction: column; gap: 16px; }
  .pending-skeleton {
    height: 140px; border-radius: var(--radius-lg);
    background: linear-gradient(90deg, var(--bg-card) 25%, var(--bg-hover) 50%, var(--bg-card) 75%);
    background-size: 200% 100%; animation: shimmer 1.5s infinite;
  }
  @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }

  .pending-empty { text-align: center; padding: 48px; background: var(--bg-card); border: 1px dashed var(--border); border-radius: var(--radius-lg); }
  .pending-empty span { font-size: 48px; display: block; margin-bottom: 12px; }
  .pending-empty p { color: var(--text-secondary); }

  /* Modal */
  .modal-overlay {
    position: fixed; inset: 0; z-index: 200;
    background: rgba(0,0,0,0.4); backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center; padding: 20px;
  }
  .modal-box {
    background: var(--bg-card); border: 1px solid var(--border);
    border-radius: var(--radius-xl); padding: 32px;
    max-width: 480px; width: 100%;
    display: flex; flex-direction: column; gap: 16px;
    animation: scaleIn 0.2s ease forwards;
  }
  .modal-box h3 { font-size: 20px; font-weight: 700; color: var(--text-primary); }
  .modal-box p  { color: var(--text-secondary); font-size: 14px; }
  .modal-actions { display: flex; gap: 10px; }
  @keyframes scaleIn { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
`;

export default AdminPendingRooms;
