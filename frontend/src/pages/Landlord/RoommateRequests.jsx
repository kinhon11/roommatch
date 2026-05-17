import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { roommateRequestService } from '../../services/roommateRequestService';
import { formatDate } from '../../utils/format';

const STATUS_MAP = {
  pending:  { label: 'Chờ xử lý', cls: 'badge-pending',  icon: '⏳' },
  accepted: { label: 'Đã chấp nhận', cls: 'badge-approved', icon: '✅' },
  rejected: { label: 'Đã từ chối',   cls: 'badge-rejected', icon: '❌' },
};

const LandlordRequests = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState({});

  // Reject modal
  const [rejectModal, setRejectModal] = useState(null); // request id
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await roommateRequestService.list();
      setRequests(Array.isArray(data) ? data : []);
    } catch { setRequests([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAccept = async (id) => {
    setActionLoading(s => ({ ...s, [id]: true }));
    try {
      const { data } = await roommateRequestService.updateStatus(id, 'accepted');
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'accepted' } : r));
      // If conversation created, offer to navigate
      if (data.conversation_id) {
        // auto-navigate to chat
      }
    } catch { /* silent */ }
    finally { setActionLoading(s => ({ ...s, [id]: false })); }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    setActionLoading(s => ({ ...s, [rejectModal]: true }));
    try {
      await roommateRequestService.updateStatus(rejectModal, 'rejected', rejectReason.trim() || undefined);
      setRequests(prev => prev.map(r =>
        r.id === rejectModal ? { ...r, status: 'rejected', rejection_reason: rejectReason.trim() } : r
      ));
      setRejectModal(null);
      setRejectReason('');
    } catch { /* silent */ }
    finally { setActionLoading(s => ({ ...s, [rejectModal]: false })); }
  };

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter);
  const counts = {
    all: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    accepted: requests.filter(r => r.status === 'accepted').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  };

  return (
    <div className="lr-page">
      <div className="container">
        <div className="lr-header animate-slideUp">
          <div>
            <h1 className="lr-title">🤝 Yêu cầu ở ghép</h1>
            <p className="lr-sub">Quản lý yêu cầu ở ghép từ người thuê</p>
          </div>
          <Link to="/landlord/dashboard" className="btn btn-ghost">← Dashboard</Link>
        </div>

        {/* Tabs */}
        <div className="lr-tabs animate-slideUp">
          {[
            { key: 'all', label: 'Tất cả' },
            { key: 'pending', label: '⏳ Chờ xử lý' },
            { key: 'accepted', label: '✅ Đã chấp nhận' },
            { key: 'rejected', label: '❌ Từ chối' },
          ].map(t => (
            <button key={t.key}
              className={`lr-tab ${filter === t.key ? 'lr-tab--active' : ''}`}
              onClick={() => setFilter(t.key)}>
              {t.label}
              <span className="lr-tab-count">{counts[t.key]}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="lr-skeleton-list">
            {[1, 2, 3].map(i => <div key={i} className="lr-skeleton" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="lr-empty">
            <span>🤝</span>
            <h3>Chưa có yêu cầu nào</h3>
            <p>{filter === 'all' ? 'Khi tenant gửi yêu cầu ở ghép, chúng sẽ hiện ở đây.' : `Không có yêu cầu "${STATUS_MAP[filter]?.label}"`}</p>
          </div>
        ) : (
          <div className="lr-list animate-fadeIn">
            {filtered.map(req => {
              const s = STATUS_MAP[req.status] || STATUS_MAP.pending;
              const roomImg = req.room?.room_images?.find(i => i.is_primary) || req.room?.room_images?.[0];
              return (
                <div key={req.id} className={`lr-card lr-card--${req.status}`}>
                  {/* Room info */}
                  <div className="lr-card__room">
                    <div className="lr-card__room-img">
                      {roomImg ? <img src={roomImg.image_url} alt="" /> : <div className="lr-card__room-placeholder">🏠</div>}
                    </div>
                    <div>
                      <Link to={`/rooms/${req.room_id}`} className="lr-card__room-title">{req.room?.title || 'Phòng'}</Link>
                      <p className="lr-card__room-addr">📍 {req.room?.address}, {req.room?.city}</p>
                    </div>
                  </div>

                  {/* Tenant info */}
                  <div className="lr-card__tenant">
                    <div className="lr-card__tenant-avatar">
                      {req.tenant?.avatar_url
                        ? <img src={req.tenant.avatar_url} alt="" />
                        : <div className="lr-card__tenant-fallback">{(req.tenant?.full_name || 'T')[0]}</div>
                      }
                    </div>
                    <div>
                      <p className="lr-card__tenant-name">{req.tenant?.full_name}</p>
                      <p className="lr-card__tenant-contact">{req.tenant?.email}</p>
                      {req.tenant?.phone && <p className="lr-card__tenant-contact">📞 {req.tenant.phone}</p>}
                    </div>
                  </div>

                  {/* Request details */}
                  <div className="lr-card__details">
                    {req.message && (
                      <div className="lr-card__detail">
                        <span className="lr-card__detail-label">💬 Lời nhắn</span>
                        <p className="lr-card__detail-value">{req.message}</p>
                      </div>
                    )}
                    <div className="lr-card__detail-row">
                      {req.move_in_date && (
                        <div className="lr-card__detail">
                          <span className="lr-card__detail-label">📅 Ngày chuyển vào</span>
                          <p className="lr-card__detail-value">{formatDate(req.move_in_date)}</p>
                        </div>
                      )}
                      <div className="lr-card__detail">
                        <span className="lr-card__detail-label">👥 Số người</span>
                        <p className="lr-card__detail-value">{req.occupants || 1}</p>
                      </div>
                      <div className="lr-card__detail">
                        <span className="lr-card__detail-label">🐾 Thú cưng</span>
                        <p className="lr-card__detail-value">{req.has_pet ? 'Có' : 'Không'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Status + Actions */}
                  <div className="lr-card__footer">
                    <div className="lr-card__footer-left">
                      <span className={`badge ${s.cls}`}>{s.icon} {s.label}</span>
                      <span className="lr-card__date">Gửi lúc {formatDate(req.created_at)}</span>
                    </div>
                    <div className="lr-card__actions">
                      {req.status === 'pending' && (
                        <>
                          <button className="btn btn-sm lr-btn-accept"
                            onClick={() => handleAccept(req.id)}
                            disabled={actionLoading[req.id]}>
                            {actionLoading[req.id] ? '...' : '✅ Chấp nhận'}
                          </button>
                          <button className="btn btn-danger btn-sm"
                            onClick={() => { setRejectModal(req.id); setRejectReason(''); }}
                            disabled={actionLoading[req.id]}>
                            ❌ Từ chối
                          </button>
                        </>
                      )}
                      {req.status === 'accepted' && (
                        <button className="btn btn-sm lr-btn-chat"
                          onClick={() => navigate('/chat')}>
                          💬 Chat
                        </button>
                      )}
                      {req.status === 'rejected' && req.rejection_reason && (
                        <p className="lr-card__reject-reason">Lý do: <em>{req.rejection_reason}</em></p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {rejectModal && (
        <div className="modal-overlay animate-fadeIn" onClick={() => setRejectModal(null)}>
          <div className="modal animate-scaleIn" onClick={e => e.stopPropagation()}>
            <h3 className="modal__title">❌ Từ chối yêu cầu</h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>
              Bạn có thể nhập lý do để tenant hiểu rõ hơn.
            </p>
            <textarea
              className="form-input"
              rows={3}
              placeholder="Lý do từ chối (tùy chọn)..."
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button className="btn btn-danger"
                onClick={handleReject}
                disabled={actionLoading[rejectModal]}>
                {actionLoading[rejectModal] ? 'Đang xử lý...' : 'Xác nhận từ chối'}
              </button>
              <button className="btn btn-ghost" onClick={() => setRejectModal(null)}>Hủy</button>
            </div>
          </div>
        </div>
      )}

      <style>{styles}</style>
    </div>
  );
};

const styles = `
  .lr-page { padding: 32px 0 80px; }
  .lr-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-bottom: 20px; }
  .lr-title { font-size: 26px; font-weight: 800; color: var(--text-primary); margin-bottom: 4px; }
  .lr-sub { font-size: 14px; color: var(--text-secondary); }

  .lr-tabs { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 24px; border-bottom: 1px solid var(--border); padding-bottom: 12px; }
  .lr-tab { display: flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: var(--radius-full); border: 1px solid var(--border); background: transparent; color: var(--text-secondary); font-size: 14px; font-weight: 500; cursor: pointer; transition: var(--transition); font-family: inherit; }
  .lr-tab:hover { border-color: var(--border-hover); color: var(--text-primary); }
  .lr-tab--active { background: var(--primary-50); border-color: var(--primary); color: var(--primary-dark); font-weight: 600; }
  .lr-tab-count { background: var(--bg-surface); padding: 1px 7px; border-radius: var(--radius-full); font-size: 12px; font-weight: 700; }
  .lr-tab--active .lr-tab-count { background: var(--primary-100); }

  .lr-list { display: flex; flex-direction: column; gap: 16px; }
  .lr-card {
    background: var(--bg-card); border: 1px solid var(--border);
    border-radius: var(--radius-lg); padding: 0;
    transition: var(--transition); overflow: hidden;
  }
  .lr-card:hover { border-color: var(--border-hover); box-shadow: var(--shadow-md); }
  .lr-card--pending  { border-left: 4px solid var(--warning); }
  .lr-card--accepted { border-left: 4px solid var(--success); }
  .lr-card--rejected { border-left: 4px solid var(--danger); opacity: .8; }

  .lr-card__room {
    display: flex; align-items: center; gap: 12px;
    padding: 16px 20px; background: var(--bg-warm);
    border-bottom: 1px solid var(--border-subtle);
  }
  .lr-card__room-img { width: 48px; height: 36px; border-radius: var(--radius-sm); overflow: hidden; flex-shrink: 0; background: var(--bg-inset); }
  .lr-card__room-img img { width: 100%; height: 100%; object-fit: cover; }
  .lr-card__room-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 18px; }
  .lr-card__room-title { font-size: 14px; font-weight: 600; color: var(--primary); }
  .lr-card__room-title:hover { text-decoration: underline; }
  .lr-card__room-addr { font-size: 12px; color: var(--text-muted); }

  .lr-card__tenant { display: flex; align-items: center; gap: 12px; padding: 14px 20px; border-bottom: 1px solid var(--border-subtle); }
  .lr-card__tenant-avatar { width: 40px; height: 40px; border-radius: 50%; overflow: hidden; flex-shrink: 0; }
  .lr-card__tenant-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .lr-card__tenant-fallback { width: 100%; height: 100%; background: var(--primary-100); color: var(--primary-dark); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 16px; }
  .lr-card__tenant-name { font-size: 14px; font-weight: 600; color: var(--text-primary); }
  .lr-card__tenant-contact { font-size: 12px; color: var(--text-muted); }

  .lr-card__details { padding: 14px 20px; display: flex; flex-direction: column; gap: 10px; }
  .lr-card__detail-label { font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: .04em; }
  .lr-card__detail-value { font-size: 14px; color: var(--text-primary); margin-top: 2px; }
  .lr-card__detail-row { display: flex; gap: 20px; flex-wrap: wrap; }

  .lr-card__footer {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 20px; border-top: 1px solid var(--border-subtle);
    background: var(--bg-surface); flex-wrap: wrap; gap: 8px;
  }
  .lr-card__footer-left { display: flex; align-items: center; gap: 10px; }
  .lr-card__date { font-size: 12px; color: var(--text-muted); }
  .lr-card__actions { display: flex; gap: 8px; align-items: center; }
  .lr-btn-accept { background: rgba(16,185,129,.15)!important; color: var(--success)!important; border: 1px solid rgba(16,185,129,.3)!important; }
  .lr-btn-accept:hover { background: rgba(16,185,129,.25)!important; }
  .lr-btn-chat { background: var(--primary-50)!important; color: var(--primary-dark)!important; border: 1px solid var(--primary-100)!important; }
  .lr-card__reject-reason { font-size: 12px; color: var(--text-muted); font-style: italic; }

  .lr-empty { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 80px 24px; text-align: center; background: var(--bg-card); border: 1px dashed var(--border); border-radius: var(--radius-xl); }
  .lr-empty span { font-size: 56px; }
  .lr-empty h3 { font-size: 22px; font-weight: 700; color: var(--text-primary); }
  .lr-empty p { color: var(--text-secondary); }

  .lr-skeleton-list { display: flex; flex-direction: column; gap: 16px; }
  .lr-skeleton { height: 180px; border-radius: var(--radius-lg); background: linear-gradient(90deg, var(--bg-card) 25%, var(--bg-hover) 50%, var(--bg-card) 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; }

  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 20px; }
  .modal { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-xl); padding: 28px; max-width: 440px; width: 100%; box-shadow: var(--shadow-xl); }
  .modal__title { font-size: 18px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px; }

  @media(max-width: 640px) {
    .lr-card__footer { flex-direction: column; align-items: flex-start; }
    .lr-header { flex-direction: column; }
  }
`;

export default LandlordRequests;
