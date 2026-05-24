import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { roommateRequestService } from '../../services/roommateRequestService';
import { formatDate } from '../../utils/format';

const STATUS_MAP = {
  pending: { label: 'Chờ xử lý', cls: 'badge-pending' },
  accepted: { label: 'Đã chấp nhận', cls: 'badge-approved' },
  rejected: { label: 'Đã từ chối', cls: 'badge-rejected' },
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

const LandlordRequests = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState({});
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const isBroker = user?.role === 'broker';
  const canDecide = user?.role === 'landlord' || user?.role === 'admin';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await roommateRequestService.list();
      setRequests(Array.isArray(data) ? data : []);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAccept = async (id) => {
    if (!canDecide) return;
    setActionLoading(state => ({ ...state, [id]: true }));
    try {
      const { data } = await roommateRequestService.updateStatus(id, 'accepted');
      setRequests(prev => prev.map(req =>
        req.id === id ? { ...req, status: 'accepted', conversation_id: data.conversation_id } : req
      ));
    } catch {
      // Toast handling is not available on this legacy page yet.
    } finally {
      setActionLoading(state => ({ ...state, [id]: false }));
    }
  };

  const handleReject = async () => {
    if (!rejectModal || !canDecide) return;
    setActionLoading(state => ({ ...state, [rejectModal]: true }));
    try {
      await roommateRequestService.updateStatus(rejectModal, 'rejected', rejectReason.trim() || undefined);
      setRequests(prev => prev.map(req =>
        req.id === rejectModal
          ? { ...req, status: 'rejected', rejection_reason: rejectReason.trim() }
          : req
      ));
      setRejectModal(null);
      setRejectReason('');
    } catch {
      // Toast handling is not available on this legacy page yet.
    } finally {
      setActionLoading(state => ({ ...state, [rejectModal]: false }));
    }
  };

  const filtered = filter === 'all' ? requests : requests.filter(req => req.status === filter);
  const counts = {
    all: requests.length,
    pending: requests.filter(req => req.status === 'pending').length,
    accepted: requests.filter(req => req.status === 'accepted').length,
    rejected: requests.filter(req => req.status === 'rejected').length,
  };

  return (
    <div className="lr-page">
      <div className="container">
        <div className="lr-header animate-slideUp">
          <div>
            <h1 className="lr-title">Yêu cầu ở ghép</h1>
            <p className="lr-sub">
              {isBroker
                ? 'Theo dõi khách quan tâm các phòng bạn được phân công.'
                : 'Quản lý yêu cầu ở ghép từ người thuê.'}
            </p>
          </div>
          <Link to={isBroker ? '/broker/dashboard' : '/landlord/dashboard'} className="btn btn-ghost">
            Quay lại Dashboard
          </Link>
        </div>

        <div className="lr-tabs animate-slideUp">
          {[
            { key: 'all', label: 'Tất cả' },
            { key: 'pending', label: 'Chờ xử lý' },
            { key: 'accepted', label: 'Đã chấp nhận' },
            { key: 'rejected', label: 'Từ chối' },
          ].map(tab => (
            <button
              key={tab.key}
              className={`lr-tab ${filter === tab.key ? 'lr-tab--active' : ''}`}
              onClick={() => setFilter(tab.key)}
            >
              {tab.label}
              <span className="lr-tab-count">{counts[tab.key]}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="lr-skeleton-list">
            {[1, 2, 3].map(item => <div key={item} className="lr-skeleton" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="lr-empty">
            <h3>Chưa có yêu cầu nào</h3>
            <p>
              {filter === 'all'
                ? 'Khi người thuê gửi yêu cầu ở ghép, chúng sẽ hiển thị ở đây.'
                : `Không có yêu cầu "${STATUS_MAP[filter]?.label}".`}
            </p>
          </div>
        ) : (
          <div className="lr-list animate-fadeIn">
            {filtered.map(req => {
              const status = STATUS_MAP[req.status] || STATUS_MAP.pending;
              const roomImg = req.room?.room_images?.find(img => img.is_primary) || req.room?.room_images?.[0];

              return (
                <div key={req.id} className={`lr-card lr-card--${req.status}`}>
                  <div className="lr-card__room">
                    <div className="lr-card__room-img">
                      {roomImg
                        ? <img src={roomImg.image_url} alt={req.room?.title || 'Phòng'} />
                        : <div className="lr-card__room-placeholder">Phòng</div>}
                    </div>
                    <div>
                      <Link to={`/rooms/${req.room_id}`} className="lr-card__room-title">
                        {req.room?.title || 'Phòng'}
                      </Link>
                      <p className="lr-card__room-addr">{req.room?.address}, {req.room?.city}</p>
                    </div>
                  </div>

                  <div className="lr-card__tenant">
                    <div className="lr-card__tenant-avatar">
                      {req.tenant?.avatar_url
                        ? <img src={req.tenant.avatar_url} alt={req.tenant?.full_name || 'Người thuê'} />
                        : <div className="lr-card__tenant-fallback">{(req.tenant?.full_name || 'T')[0]}</div>}
                    </div>
                    <div>
                      <p className="lr-card__tenant-name">{req.tenant?.full_name || 'Người thuê'}</p>
                      <p className="lr-card__tenant-contact">{req.tenant?.email}</p>
                      {req.tenant?.phone && <p className="lr-card__tenant-contact">{req.tenant.phone}</p>}
                    </div>
                  </div>

                  <div className="lr-card__details">
                    {req.message && (
                      <div className="lr-card__detail">
                        <span className="lr-card__detail-label">Lời nhắn</span>
                        <p className="lr-card__detail-value">{req.message}</p>
                      </div>
                    )}
                    <div className="lr-card__detail-row">
                      {req.move_in_date && (
                        <div className="lr-card__detail">
                          <span className="lr-card__detail-label">Ngày chuyển vào</span>
                          <p className="lr-card__detail-value">{formatDate(req.move_in_date)}</p>
                        </div>
                      )}
                      <div className="lr-card__detail">
                        <span className="lr-card__detail-label">Số người</span>
                        <p className="lr-card__detail-value">{req.occupants || 1}</p>
                      </div>
                      <div className="lr-card__detail">
                        <span className="lr-card__detail-label">Thú cưng</span>
                        <p className="lr-card__detail-value">{req.has_pet ? 'Có' : 'Không'}</p>
                      </div>
                    </div>
                    <div className="lr-card__detail-row">
                      <div className="lr-card__detail">
                        <span className="lr-card__detail-label">Giới tính</span>
                        <p className="lr-card__detail-value">{REQUESTER_GENDER_LABELS[req.requester_gender] || 'Chưa cập nhật'}</p>
                      </div>
                      <div className="lr-card__detail">
                        <span className="lr-card__detail-label">Muốn ở cùng</span>
                        <p className="lr-card__detail-value">{PREFERRED_GENDER_LABELS[req.preferred_roommate_gender] || 'Không yêu cầu'}</p>
                      </div>
                      <div className="lr-card__detail">
                        <span className="lr-card__detail-label">Nghề nghiệp</span>
                        <p className="lr-card__detail-value">{req.occupation || 'Chưa cập nhật'}</p>
                      </div>
                      <div className="lr-card__detail">
                        <span className="lr-card__detail-label">Giờ giấc</span>
                        <p className="lr-card__detail-value">{SCHEDULE_LABELS[req.schedule_type] || 'Linh hoạt'}</p>
                      </div>
                      <div className="lr-card__detail">
                        <span className="lr-card__detail-label">Gọn gàng</span>
                        <p className="lr-card__detail-value">{CLEANLINESS_LABELS[req.cleanliness_level] || 'Bình thường'}</p>
                      </div>
                      <div className="lr-card__detail">
                        <span className="lr-card__detail-label">Hút thuốc</span>
                        <p className="lr-card__detail-value">{req.is_smoker ? 'Có' : 'Không'} / {req.okay_with_smoker ? 'chấp nhận bạn cùng phòng hút thuốc' : 'không muốn ở với người hút thuốc'}</p>
                      </div>
                      <div className="lr-card__detail">
                        <span className="lr-card__detail-label">Ở với thú cưng</span>
                        <p className="lr-card__detail-value">{req.okay_with_pets ? 'Chấp nhận' : 'Không muốn'}</p>
                      </div>
                      {req.roommate_note && (
                        <div className="lr-card__detail">
                          <span className="lr-card__detail-label">Ghi chú ở ghép</span>
                          <p className="lr-card__detail-value">{req.roommate_note}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="lr-card__footer">
                    <div className="lr-card__footer-left">
                      <span className={`badge ${status.cls}`}>{status.label}</span>
                      <span className="lr-card__date">Gửi lúc {formatDate(req.created_at)}</span>
                    </div>
                    <div className="lr-card__actions">
                      {req.status === 'pending' && canDecide && (
                        <>
                          <button
                            className="btn btn-sm lr-btn-accept"
                            onClick={() => handleAccept(req.id)}
                            disabled={actionLoading[req.id]}
                          >
                            {actionLoading[req.id] ? 'Đang xử lý...' : 'Chấp nhận'}
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => { setRejectModal(req.id); setRejectReason(''); }}
                            disabled={actionLoading[req.id]}
                          >
                            Từ chối
                          </button>
                        </>
                      )}
                      {req.status === 'pending' && isBroker && (
                        <span className="lr-card__broker-note">Chờ chủ nhà quyết định</span>
                      )}
                      {req.status === 'accepted' && (
                        <button
                          className="btn btn-sm lr-btn-chat"
                          onClick={() => navigate(req.conversation_id
                            ? `/chat/${req.conversation_id}`
                            : `/chat?tenant=${req.tenant_id}&room=${req.room_id}`)}
                        >
                          Chat
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

      {rejectModal && canDecide && (
        <div className="modal-overlay animate-fadeIn" onClick={() => setRejectModal(null)}>
          <div className="modal animate-scaleIn" onClick={event => event.stopPropagation()}>
            <h3 className="modal__title">Từ chối yêu cầu</h3>
            <p className="modal__desc">
              Bạn có thể nhập lý do để người thuê hiểu rõ hơn.
            </p>
            <textarea
              className="form-input"
              rows={3}
              placeholder="Lý do từ chối (tùy chọn)..."
              value={rejectReason}
              onChange={event => setRejectReason(event.target.value)}
            />
            <div className="modal__actions">
              <button
                className="btn btn-danger"
                onClick={handleReject}
                disabled={actionLoading[rejectModal]}
              >
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
  .lr-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 0; transition: var(--transition); overflow: hidden; }
  .lr-card:hover { border-color: var(--border-hover); box-shadow: var(--shadow-md); }
  .lr-card--pending { box-shadow: inset 4px 0 0 var(--warning); }
  .lr-card--accepted { box-shadow: inset 4px 0 0 var(--success); }
  .lr-card--rejected { box-shadow: inset 4px 0 0 var(--danger); opacity: .8; }

  .lr-card__room { display: flex; align-items: center; gap: 12px; padding: 16px 20px; background: var(--bg-warm); border-bottom: 1px solid var(--border-subtle); }
  .lr-card__room-img { width: 48px; height: 36px; border-radius: var(--radius-sm); overflow: hidden; flex-shrink: 0; background: var(--bg-inset); }
  .lr-card__room-img img { width: 100%; height: 100%; object-fit: cover; }
  .lr-card__room-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 12px; color: var(--text-muted); }
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

  .lr-card__footer { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; border-top: 1px solid var(--border-subtle); background: var(--bg-surface); flex-wrap: wrap; gap: 8px; }
  .lr-card__footer-left { display: flex; align-items: center; gap: 10px; }
  .lr-card__date { font-size: 12px; color: var(--text-muted); }
  .lr-card__actions { display: flex; gap: 8px; align-items: center; }
  .lr-btn-accept { background: rgba(16,185,129,.15)!important; color: var(--success)!important; border: 1px solid rgba(16,185,129,.3)!important; }
  .lr-btn-accept:hover { background: rgba(16,185,129,.25)!important; }
  .lr-btn-chat { background: var(--primary-50)!important; color: var(--primary-dark)!important; border: 1px solid var(--primary-100)!important; }
  .lr-card__reject-reason { font-size: 12px; color: var(--text-muted); font-style: italic; }
  .lr-card__broker-note { font-size: 12px; color: var(--text-secondary); background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-full); padding: 6px 10px; }

  .lr-empty { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 80px 24px; text-align: center; background: var(--bg-card); border: 1px dashed var(--border); border-radius: var(--radius-xl); }
  .lr-empty h3 { font-size: 22px; font-weight: 700; color: var(--text-primary); }
  .lr-empty p { color: var(--text-secondary); }

  .lr-skeleton-list { display: flex; flex-direction: column; gap: 16px; }
  .lr-skeleton { height: 180px; border-radius: var(--radius-lg); background: linear-gradient(90deg, var(--bg-card) 25%, var(--bg-hover) 50%, var(--bg-card) 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; }

  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 20px; }
  .modal { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-xl); padding: 28px; max-width: 440px; width: 100%; box-shadow: var(--shadow-xl); }
  .modal__title { font-size: 18px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px; }
  .modal__desc { font-size: 14px; color: var(--text-secondary); margin-bottom: 12px; }
  .modal__actions { display: flex; gap: 10px; margin-top: 16px; }

  @media(max-width: 640px) {
    .lr-card__footer { flex-direction: column; align-items: flex-start; }
    .lr-header { flex-direction: column; }
  }
`;

export default LandlordRequests;
