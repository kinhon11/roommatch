import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { roomService } from '../../services/roomService';
import useFetch from '../../hooks/useFetch';
import { formatCurrency, formatDate } from '../../utils/format';

const STATUS_MAP = {
  pending:  { label: 'Chờ duyệt', cls: 'badge-pending' },
  approved: { label: 'Đã duyệt',  cls: 'badge-approved' },
  rejected: { label: 'Từ chối',   cls: 'badge-rejected' },
};

const MyRooms = () => {
  const navigate = useNavigate();
  const [deletingId, setDeletingId] = useState(null);
  const [confirmId, setConfirmId]   = useState(null);
  const [toggling, setToggling]     = useState({});

  const { data: rooms, loading, error, refetch } = useFetch(
    () => roomService.getMyRooms(),
    []
  );

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await roomService.deleteRoom(id);
      refetch();
    } catch (err) {
      alert(err?.response?.data?.error || 'Xóa thất bại!');
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
    setToggling(s => ({ ...s, [id]: true }));
    try {
      await roomService.toggleRoomAvailable(id);
      refetch();
    } catch { /* silent */ }
    finally { setToggling(s => ({ ...s, [id]: false })); }
  };

  return (
    <div className="my-rooms-page">
      <div className="container">
        {/* Header */}
        <div className="mr-header animate-slideUp">
          <div>
            <h1>🏠 Phòng của tôi</h1>
            <p>Quản lý toàn bộ bài đăng phòng trọ của bạn</p>
          </div>
          <Link to="/landlord/post" id="btn-new-room" className="btn btn-primary">+ Đăng tin mới</Link>
        </div>

        {/* Content */}
        {loading && (
          <div className="loading-screen" style={{ minHeight: 300 }}>
            <div className="spinner" /><p>Đang tải...</p>
          </div>
        )}

        {error && <div className="alert alert-error">⚠️ {error}</div>}

        {!loading && rooms?.length === 0 && (
          <div className="mr-empty animate-scaleIn">
            <div className="mr-empty-icon">🏠</div>
            <h3>Bạn chưa có phòng nào</h3>
            <p>Bắt đầu đăng tin phòng trọ để tiếp cận hàng nghìn người tìm phòng.</p>
            <Link to="/landlord/post" className="btn btn-primary btn-lg">📝 Đăng tin ngay</Link>
          </div>
        )}

        {!loading && rooms?.length > 0 && (
          <div className="mr-grid animate-fadeIn">
            {rooms.map(room => {
              const status = STATUS_MAP[room.status] || STATUS_MAP.pending;
              const primary = room.room_images?.find(i => i.is_primary) || room.room_images?.[0];

              return (
                <div key={room.id} className="mr-card">
                  {/* Ảnh */}
                  <div className="mr-card-img">
                    {primary
                      ? <img src={primary.image_url} alt={room.title} />
                      : <div className="mr-card-img-placeholder">🏠</div>
                    }
                    <span className={`badge ${status.cls} mr-card-badge`}>{status.label}</span>
                    {room.is_hidden && <span className="badge badge-hidden mr-card-badge" style={{top:'auto',bottom:10}}>Tạm ẩn</span>}
                  </div>

                  {/* Info */}
                  <div className="mr-card-body">
                    <h3 className="mr-card-title">{room.title}</h3>
                    <p className="mr-card-addr">📍 {room.address}, {room.city}</p>
                    <div className="mr-card-meta">
                      <span className="mr-card-price">{formatCurrency(room.price)}/tháng</span>
                      {room.area && <span className="mr-card-area">📐 {room.area} m²</span>}
                    </div>
                    {room.rejection_reason && (
                      <div className="mr-card-reject">
                        ❌ Lý do từ chối: <em>{room.rejection_reason}</em>
                      </div>
                    )}
                    <p className="mr-card-date">🕒 {formatDate(room.created_at)}</p>
                  </div>

                  {/* Actions */}
                  <div className="mr-card-actions">
                    <button className="btn btn-secondary btn-sm"
                      onClick={() => navigate(`/landlord/edit/${room.id}`)}>
                      ✏️ Sửa
                    </button>
                    {room.status === 'approved' && (
                      <>
                        <button className="btn btn-sm"
                          style={{ background: room.is_hidden ? 'rgba(245,158,11,.12)' : 'var(--bg-surface)', color: room.is_hidden ? 'var(--warning)' : 'var(--text-secondary)', border: '1px solid var(--border)' }}
                          onClick={() => handleToggleHidden(room.id)}
                          disabled={toggling[room.id]}>
                          {room.is_hidden ? '👁️ Hiện' : '🙈 Ẩn'}
                        </button>
                        <button className="btn btn-sm"
                          style={{ background: room.is_available ? 'rgba(16,185,129,.1)' : 'rgba(239,68,68,.08)', color: room.is_available ? 'var(--success)' : 'var(--danger)', border: '1px solid var(--border)' }}
                          onClick={() => handleToggleAvailable(room.id)}
                          disabled={toggling[room.id]}>
                          {room.is_available ? '🟢 Còn phòng' : '🔴 Hết phòng'}
                        </button>
                      </>
                    )}
                    <button className="btn btn-danger btn-sm"
                      onClick={() => setConfirmId(room.id)}>
                      🗑️ Xóa
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Confirm delete modal */}
        {confirmId && (
          <div className="modal-overlay animate-fadeIn" onClick={() => setConfirmId(null)}>
            <div className="modal animate-scaleIn" onClick={e => e.stopPropagation()}>
              <h3>⚠️ Xác nhận xóa</h3>
              <p>Bạn chắc chắn muốn xóa bài đăng này không? Hành động này không thể hoàn tác.</p>
              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={() => setConfirmId(null)}>Hủy</button>
                <button className="btn btn-danger" disabled={deletingId === confirmId}
                  onClick={() => handleDelete(confirmId)}>
                  {deletingId === confirmId ? 'Đang xóa...' : 'Xóa ngay'}
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
  .mr-header { display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;margin-bottom:32px; }
  .mr-header h1 { font-size:28px;font-weight:800;color:var(--text-primary);margin-bottom:6px; }
  .mr-header p  { color:var(--text-secondary);font-size:15px; }
  .alert { padding:14px 18px;border-radius:var(--radius-md);font-size:14px;margin-bottom:20px; }
  .alert-error { background:var(--danger-light);color:var(--danger);border:1px solid #fecaca; }
  /* Empty state */
  .mr-empty { text-align:center;padding:80px 40px;background:var(--bg-card);border:1px dashed var(--border);border-radius:var(--radius-xl); }
  .mr-empty-icon { font-size:64px;margin-bottom:16px; }
  .mr-empty h3 { font-size:22px;font-weight:700;color:var(--text-primary);margin-bottom:10px; }
  .mr-empty p  { color:var(--text-secondary);margin-bottom:24px; }
  /* Grid */
  .mr-grid { display:grid;grid-template-columns:repeat(3,1fr);gap:20px; }
  @media(max-width:1024px){.mr-grid{grid-template-columns:repeat(2,1fr);}}
  @media(max-width:600px) {.mr-grid{grid-template-columns:1fr;}}
  /* Card */
  .mr-card { background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;transition:var(--transition); }
  .mr-card:hover { border-color:var(--border-hover);transform:translateY(-4px);box-shadow:var(--shadow-md); }
  .mr-card-img { position:relative;aspect-ratio:16/9;overflow:hidden;background:var(--bg-surface); }
  .mr-card-img img { width:100%;height:100%;object-fit:cover;transition:var(--transition); }
  .mr-card:hover .mr-card-img img { transform:scale(1.05); }
  .mr-card-img-placeholder { display:flex;align-items:center;justify-content:center;height:100%;font-size:48px;color:var(--text-muted); }
  .mr-card-badge { position:absolute;top:10px;left:10px; }
  .mr-card-body { padding:16px;display:flex;flex-direction:column;gap:6px; }
  .mr-card-title { font-size:15px;font-weight:700;color:var(--text-primary);line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden; }
  .mr-card-addr { font-size:13px;color:var(--text-muted); }
  .mr-card-meta { display:flex;align-items:center;gap:12px;flex-wrap:wrap; }
  .mr-card-price { font-weight:700;color:var(--primary);font-size:14px; }
  .mr-card-area  { font-size:12px;color:var(--text-muted); }
  .mr-card-reject { font-size:12px;color:var(--danger);background:rgba(239,68,68,.08);border-radius:var(--radius-sm);padding:6px 10px; }
  .mr-card-date  { font-size:12px;color:var(--text-muted); }
  .mr-card-actions { padding:12px 16px;border-top:1px solid var(--border);display:flex;gap:8px;flex-wrap:wrap; }
  .badge-hidden { background:rgba(245,158,11,.15);color:#d97706;border:1px solid rgba(245,158,11,.3); }
  /* Modal */
  .modal-overlay { position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px; }
  .modal { background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-xl);padding:32px;max-width:400px;width:100%; }
  .modal h3 { font-size:20px;font-weight:700;color:var(--text-primary);margin-bottom:12px; }
  .modal p  { color:var(--text-secondary);font-size:14px;line-height:1.6;margin-bottom:24px; }
  .modal-actions { display:flex;gap:12px;justify-content:flex-end; }
`;

export default MyRooms;
