import { useState, useEffect } from 'react';

import { roomService } from '../../services/roomService';
import apiClient from '../../api/apiClient';
import { formatCurrency as formatPrice, formatDate } from '../../utils/format';

const AdminPendingRooms = () => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionState, setActionState] = useState({}); // { [id]: { loading, error } }
  const [rejectModal, setRejectModal] = useState(null); // { roomId, reason }

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

  const primaryImg = (rm) =>
    rm.room_images?.find(i => i.is_primary)?.image_url || rm.room_images?.[0]?.image_url || null;

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
        <div className="pending-list">
          {rooms.map(room => (
            <div key={room.id} className="pending-card">
              {/* Image */}
              <div className="pending-card__img">
                {primaryImg(room)
                  ? <img src={primaryImg(room)} alt={room.title} />
                  : <div className="pending-card__no-img">🏠</div>
                }
              </div>

              {/* Content */}
              <div className="pending-card__body">
                <h3 className="pending-card__title">{room.title}</h3>
                <p className="pending-card__meta">
                  📍 {room.address}, {room.city} &nbsp;|&nbsp;
                  💰 {formatPrice(room.price)}/tháng
                  {room.area && <> &nbsp;|&nbsp; 📐 {room.area} m²</>}
                </p>
                <p className="pending-card__host">
                  👤 Chủ nhà: <strong>{room.users?.full_name}</strong>
                  {room.users?.phone && <> · {room.users.phone}</>}
                </p>
                <p className="pending-card__date">📅 Đăng: {formatDate(room.created_at)}</p>
                {room.description && (
                  <p className="pending-card__desc">{room.description.slice(0, 150)}{room.description.length > 150 ? '...' : ''}</p>
                )}
                {room.room_approval_history?.length > 0 && (
                  <p className="pending-card__date">
                    Lan duyet gan nhat: {room.room_approval_history[0].to_status}
                    {room.room_approval_history[0].reason ? ` - ${room.room_approval_history[0].reason}` : ''}
                  </p>
                )}
                {actionState[room.id]?.error && <p className="form-error">{actionState[room.id].error}</p>}
              </div>

              {/* Actions */}
              <div className="pending-card__actions">
                <button
                  id={`btn-approve-${room.id}`}
                  className="btn btn-sm"
                  style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.3)' }}
                  disabled={actionState[room.id]?.loading}
                  onClick={() => handleApprove(room.id)}
                >
                  {actionState[room.id]?.loading ? '...' : '✅ Duyệt'}
                </button>
                <button
                  id={`btn-reject-${room.id}`}
                  className="btn btn-danger btn-sm"
                  disabled={actionState[room.id]?.loading}
                  onClick={() => setRejectModal({ roomId: room.id, reason: '' })}
                >
                  ❌ Từ chối
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{styles}</style>
    </div>
  );
};

const styles = `
  .admin-pending-page { padding: 20px 0; }
  .pending-header { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
  .pending-header h2 { font-size: 22px; font-weight: 800; color: var(--text-primary); }

  .pending-list { display: flex; flex-direction: column; gap: 16px; }
  .pending-card {
    display: flex; gap: 20px; align-items: flex-start;
    background: var(--bg-card); border: 1px solid var(--border);
    border-radius: var(--radius-lg); padding: 20px;
    transition: var(--transition);
  }
  .pending-card:hover { border-color: var(--border-hover); }

  .pending-card__img {
    flex-shrink: 0; width: 140px; height: 110px;
    border-radius: var(--radius-md); overflow: hidden; background: var(--bg-surface);
  }
  .pending-card__img img { width: 100%; height: 100%; object-fit: cover; }
  .pending-card__no-img { height: 100%; display: flex; align-items: center; justify-content: center; font-size: 40px; color: var(--text-muted); }

  .pending-card__body { flex: 1; display: flex; flex-direction: column; gap: 6px; }
  .pending-card__title { font-size: 17px; font-weight: 700; color: var(--text-primary); }
  .pending-card__meta { font-size: 13px; color: var(--text-secondary); }
  .pending-card__host { font-size: 13px; color: var(--text-secondary); }
  .pending-card__date { font-size: 12px; color: var(--text-muted); }
  .pending-card__desc { font-size: 13px; color: var(--text-secondary); line-height: 1.6; margin-top: 4px; }

  .pending-card__actions { display: flex; flex-direction: column; gap: 8px; flex-shrink: 0; }
  @media(max-width: 700px) {
    .pending-card { flex-direction: column; }
    .pending-card__img { width: 100%; height: 180px; }
    .pending-card__actions { flex-direction: row; }
  }

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
