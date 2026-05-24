import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { roommateRequestService } from '../../services/roommateRequestService';
import { formatDate } from '../../utils/format';
import { useDialog } from '../../context/DialogContext';
import { useToast } from '../../context/ToastContext';

const STATUS_MAP = {
  pending:  { label: 'Chờ phản hồi', cls: 'badge-pending',  icon: '⏳' },
  accepted: { label: 'Đã chấp nhận', cls: 'badge-approved', icon: '✅' },
  rejected: { label: 'Đã từ chối',   cls: 'badge-rejected', icon: '❌' },
};

const REQUESTER_GENDER_LABELS = {
  male: 'Nam',
  female: 'Nữ',
  other: 'Khác',
  prefer_not_to_say: 'Không muốn nói',
};
const PREFERRED_GENDER_LABELS = {
  any: 'Không yêu cầu',
  male: 'Nam',
  female: 'Nữ',
};
const SCHEDULE_LABELS = {
  student: 'Sinh viên',
  office: 'Giờ hành chính',
  shift: 'Làm theo ca',
  night: 'Hay về khuya / ca đêm',
  flexible: 'Linh hoạt',
  other: 'Khác',
};
const CLEANLINESS_LABELS = {
  normal: 'Bình thường',
  tidy: 'Gọn gàng',
  very_tidy: 'Rất gọn gàng',
};

const MyRequestsPage = () => {
  useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('all');
  const [actionId, setActionId] = useState(null);
  const [msg, setMsg]           = useState('');
  const dialog = useDialog();
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await roommateRequestService.list();
      setRequests(Array.isArray(data) ? data : []);
    } catch { setRequests([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCancel = async (id) => {
    const confirmed = await dialog.confirm({
      title: 'Hủy yêu cầu ở ghép',
      message: 'Bạn có chắc muốn hủy yêu cầu này? Chủ nhà sẽ không còn thấy yêu cầu của bạn.',
      confirmText: 'Hủy yêu cầu',
    });
    if (!confirmed) return;
    setActionId(id);
    setMsg('');
    try {
      await roommateRequestService.cancel(id);
      setRequests(prev => prev.filter(r => r.id !== id));
      setMsg('✅ Đã hủy yêu cầu thành công.');
      toast.success('Đã hủy yêu cầu ở ghép.');
    } catch (err) {
      setMsg('❌ ' + (err.response?.data?.error || 'Không thể hủy yêu cầu.'));
      toast.error(err.response?.data?.error || 'Không thể hủy yêu cầu.');
    } finally { setActionId(null); }
  };

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter);
  const counts = {
    all:      requests.length,
    pending:  requests.filter(r => r.status === 'pending').length,
    accepted: requests.filter(r => r.status === 'accepted').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  };

  return (
    <div className="mreq-page">
      <div className="container">
        <div className="mreq-header animate-slideUp">
          <div>
            <h1 className="mreq-title">🤝 Yêu cầu ở ghép của tôi</h1>
            <p className="mreq-sub">Theo dõi tình trạng các yêu cầu ở ghép bạn đã gửi</p>
          </div>
          <Link to="/rooms" className="btn btn-primary">🔍 Tìm phòng</Link>
        </div>

        {msg && (
          <div className={`mreq-msg ${msg.startsWith('✅') ? 'mreq-msg--ok' : 'mreq-msg--err'} animate-slideUp`}>
            {msg}
          </div>
        )}

        {/* Filter Tabs */}
        <div className="mreq-tabs animate-slideUp">
          {[
            { key: 'all',      label: 'Tất cả' },
            { key: 'pending',  label: '⏳ Đang chờ' },
            { key: 'accepted', label: '✅ Đã chấp nhận' },
            { key: 'rejected', label: '❌ Từ chối' },
          ].map(t => (
            <button key={t.key}
              className={`mreq-tab ${filter === t.key ? 'mreq-tab--active' : ''}`}
              onClick={() => setFilter(t.key)}>
              {t.label}
              <span className="mreq-tab-count">{counts[t.key]}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="mreq-skeleton-list">
            {[1, 2, 3].map(i => <div key={i} className="mreq-skeleton" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="mreq-empty">
            <span>🤝</span>
            <h3>Chưa có yêu cầu nào</h3>
            <p>
              {filter === 'all'
                ? 'Hãy vào trang chi tiết phòng để gửi yêu cầu ở ghép!'
                : `Không có yêu cầu ở trạng thái "${STATUS_MAP[filter]?.label}"`}
            </p>
            {filter === 'all' && (
              <Link to="/rooms" className="btn btn-primary" style={{ marginTop: 12 }}>Tìm phòng ngay</Link>
            )}
          </div>
        ) : (
          <div className="mreq-list animate-fadeIn">
            {filtered.map(req => {
              const s = STATUS_MAP[req.status] || STATUS_MAP.pending;
              const isLoading = actionId === req.id;
              const roomImg = req.room?.room_images?.find(i => i.is_primary) || req.room?.room_images?.[0];
              return (
                <div key={req.id} className={`mreq-card mreq-card--${req.status}`}>
                  {/* Room info row */}
                  <div className="mreq-card__room">
                    <div className="mreq-card__room-img">
                      {roomImg ? <img src={roomImg.image_url} alt="" />
                        : <div className="mreq-card__room-placeholder">🏠</div>}
                    </div>
                    <div className="mreq-card__room-info">
                      <Link to={`/rooms/${req.room_id}`} className="mreq-room-link">
                        🏠 {req.room?.title || 'Phòng'}
                      </Link>
                      <p className="mreq-city">{req.room?.city && `📍 ${req.room.address || ''}, ${req.room.city}`}</p>
                    </div>
                    <span className={`badge ${s.cls}`}>{s.icon} {s.label}</span>
                  </div>

                  {/* Details */}
                  <div className="mreq-card__details">
                    {req.message && (
                      <div className="mreq-card__detail">
                        <span className="mreq-card__detail-label">💬 Lời nhắn</span>
                        <p>{req.message}</p>
                      </div>
                    )}
                    <div className="mreq-card__detail-row">
                      {req.move_in_date && (
                        <div className="mreq-card__detail">
                          <span className="mreq-card__detail-label">📅 Ngày chuyển vào</span>
                          <p>{formatDate(req.move_in_date)}</p>
                        </div>
                      )}
                      <div className="mreq-card__detail">
                        <span className="mreq-card__detail-label">👥 Số người</span>
                        <p>{req.occupants || 1}</p>
                      </div>
                      <div className="mreq-card__detail">
                        <span className="mreq-card__detail-label">🐾 Thú cưng</span>
                        <p>{req.has_pet ? 'Có' : 'Không'}</p>
                      </div>
                      <div className="mreq-card__detail">
                        <span className="mreq-card__detail-label">🚻 Giới tính</span>
                        <p>{REQUESTER_GENDER_LABELS[req.requester_gender] || 'Chưa cập nhật'}</p>
                      </div>
                      <div className="mreq-card__detail">
                        <span className="mreq-card__detail-label">🤝 Muốn ở cùng</span>
                        <p>{PREFERRED_GENDER_LABELS[req.preferred_roommate_gender] || 'Không yêu cầu'}</p>
                      </div>
                      <div className="mreq-card__detail">
                        <span className="mreq-card__detail-label">💼 Nghề nghiệp</span>
                        <p>{req.occupation || 'Chưa cập nhật'}</p>
                      </div>
                      <div className="mreq-card__detail">
                        <span className="mreq-card__detail-label">🕐 Giờ giấc</span>
                        <p>{SCHEDULE_LABELS[req.schedule_type] || 'Linh hoạt'}</p>
                      </div>
                      <div className="mreq-card__detail">
                        <span className="mreq-card__detail-label">🧹 Gọn gàng</span>
                        <p>{CLEANLINESS_LABELS[req.cleanliness_level] || 'Bình thường'}</p>
                      </div>
                      <div className="mreq-card__detail">
                        <span className="mreq-card__detail-label">🚬 Hút thuốc</span>
                        <p>{req.is_smoker ? 'Có' : 'Không'} / {req.okay_with_smoker ? 'chấp nhận' : 'không muốn'}</p>
                      </div>
                      <div className="mreq-card__detail">
                        <span className="mreq-card__detail-label">🐾 Ở với pet</span>
                        <p>{req.okay_with_pets ? 'Chấp nhận' : 'Không muốn'}</p>
                      </div>
                      <div className="mreq-card__detail">
                        <span className="mreq-card__detail-label">📆 Gửi lúc</span>
                        <p>{formatDate(req.created_at)}</p>
                      </div>
                    </div>
                    {req.roommate_note && (
                      <div className="mreq-card__detail">
                        <span className="mreq-card__detail-label">📝 Ghi chú ở ghép</span>
                        <p>{req.roommate_note}</p>
                      </div>
                    )}

                    {/* Rejection reason */}
                    {req.status === 'rejected' && req.rejection_reason && (
                      <div className="mreq-reject-box">
                        <span>❌</span>
                        <div>
                          <p className="mreq-reject-label">Lý do từ chối:</p>
                          <p className="mreq-reject-reason">{req.rejection_reason}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mreq-card__actions">
                    {req.status === 'pending' && (
                      <button className="btn btn-danger btn-sm"
                        onClick={() => handleCancel(req.id)} disabled={isLoading}>
                        {isLoading ? '...' : '🗑 Hủy yêu cầu'}
                      </button>
                    )}
                    {req.status === 'accepted' && (
                      <>
                        <Link to={`/rooms/${req.room_id}`} className="btn btn-sm"
                          style={{ background: 'rgba(16,185,129,.15)', color: 'var(--success)', border: '1px solid rgba(16,185,129,.3)' }}>
                          🏠 Xem phòng
                        </Link>
                        <Link to={`/chat?landlord=${req.room?.broker_id || req.room?.host_id}&room=${req.room_id}`} className="btn btn-primary btn-sm">💬 Nhắn tin</Link>
                      </>
                    )}
                    {req.status === 'rejected' && (
                      <Link to={`/rooms/${req.room_id}`} className="btn btn-ghost btn-sm">Xem phòng</Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        .mreq-page { padding: 40px 0 80px; }
        .mreq-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-bottom: 20px; }
        .mreq-title { font-size: 28px; font-weight: 800; color: var(--text-primary); margin-bottom: 6px; }
        .mreq-sub { font-size: 14px; color: var(--text-secondary); }
        .mreq-msg { padding: 12px 18px; border-radius: var(--radius-md); font-size: 14px; margin-bottom: 20px; font-weight: 500; }
        .mreq-msg--ok  { background: rgba(16,185,129,.1); color: var(--success); border: 1px solid rgba(16,185,129,.3); }
        .mreq-msg--err { background: rgba(239,68,68,.1); color: var(--danger); border: 1px solid rgba(239,68,68,.3); }
        .mreq-tabs { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 24px; border-bottom: 1px solid var(--border); padding-bottom: 12px; }
        .mreq-tab { display: flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: var(--radius-full); border: 1px solid var(--border); background: transparent; color: var(--text-secondary); font-size: 14px; font-weight: 500; cursor: pointer; transition: var(--transition); font-family: inherit; }
        .mreq-tab:hover { border-color: var(--border-hover); color: var(--text-primary); }
        .mreq-tab--active { background: var(--primary-50); border-color: var(--primary); color: var(--primary-dark); font-weight: 600; }
        .mreq-tab-count { background: var(--bg-surface); padding: 1px 7px; border-radius: var(--radius-full); font-size: 12px; font-weight: 700; }
        .mreq-tab--active .mreq-tab-count { background: var(--primary-100); }

        .mreq-list { display: flex; flex-direction: column; gap: 14px; }
        .mreq-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; transition: var(--transition); }
        .mreq-card:hover { border-color: var(--border-hover); box-shadow: var(--shadow-md); }
        .mreq-card--pending  { border-left: 3px solid var(--warning); }
        .mreq-card--accepted { border-left: 3px solid var(--success); }
        .mreq-card--rejected { border-left: 3px solid var(--danger); opacity: .75; }

        .mreq-card__room { display: flex; align-items: center; gap: 12px; padding: 14px 20px; background: var(--bg-warm); border-bottom: 1px solid var(--border-subtle); }
        .mreq-card__room-img { width: 44px; height: 32px; border-radius: var(--radius-sm); overflow: hidden; flex-shrink: 0; background: var(--bg-inset); }
        .mreq-card__room-img img { width: 100%; height: 100%; object-fit: cover; }
        .mreq-card__room-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 16px; }
        .mreq-card__room-info { flex: 1; }
        .mreq-room-link { font-size: 14px; font-weight: 600; color: var(--primary); }
        .mreq-room-link:hover { text-decoration: underline; }
        .mreq-city { font-size: 12px; color: var(--text-muted); margin-top: 2px; }

        .mreq-card__details { padding: 14px 20px; display: flex; flex-direction: column; gap: 10px; }
        .mreq-card__detail-label { font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: .04em; }
        .mreq-card__detail p { font-size: 14px; color: var(--text-primary); margin-top: 2px; }
        .mreq-card__detail-row { display: flex; gap: 20px; flex-wrap: wrap; }

        .mreq-reject-box { display: flex; align-items: flex-start; gap: 10px; padding: 10px 14px; background: rgba(239,68,68,.05); border: 1px solid rgba(239,68,68,.15); border-radius: var(--radius-md); }
        .mreq-reject-box span { font-size: 18px; flex-shrink: 0; }
        .mreq-reject-label { font-size: 12px; font-weight: 600; color: var(--danger); }
        .mreq-reject-reason { font-size: 13px; color: var(--text-secondary); font-style: italic; margin-top: 2px; }

        .mreq-card__actions { display: flex; gap: 8px; padding: 12px 20px; border-top: 1px solid var(--border-subtle); background: var(--bg-surface); }

        .mreq-empty { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 80px 24px; text-align: center; background: var(--bg-card); border: 1px dashed var(--border); border-radius: var(--radius-xl); }
        .mreq-empty span { font-size: 56px; }
        .mreq-empty h3 { font-size: 22px; font-weight: 700; color: var(--text-primary); }
        .mreq-empty p  { color: var(--text-secondary); }

        .mreq-skeleton-list { display: flex; flex-direction: column; gap: 14px; }
        .mreq-skeleton { height: 140px; border-radius: var(--radius-lg); background: linear-gradient(90deg, var(--bg-card) 25%, var(--bg-hover) 50%, var(--bg-card) 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }

        @media (max-width: 640px) {
          .mreq-card__room { flex-wrap: wrap; }
          .mreq-card__detail-row { flex-direction: column; gap: 8px; }
          .mreq-header { flex-direction: column; }
        }
      `}</style>
    </div>
  );
};

export default MyRequestsPage;
