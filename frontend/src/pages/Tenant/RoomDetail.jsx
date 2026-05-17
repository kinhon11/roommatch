import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { roomService } from '../../services/roomService';
import { formatCurrency as formatPrice, formatDate } from '../../utils/format';
import { useAuth } from '../../hooks/useAuth';
import apiClient from '../../api/apiClient';
import { favoriteService } from '../../services/favoriteService';
import { reportService } from '../../services/reportService';
import { roommateRequestService } from '../../services/roommateRequestService';
import { appointmentService } from '../../services/appointmentService';
import { depositService } from '../../services/depositService';
import { formatCurrency } from '../../utils/format';

const RoomDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImg, setActiveImg] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const [review, setReview] = useState({ rating: 5, comment: '' });
  const [submitReview, setSubmitReview] = useState({ loading: false, error: null, success: false });

  // Review eligibility & edit/delete state
  const [reviewEligibility, setReviewEligibility] = useState({ eligible: false, already_reviewed: false, review_id: null });
  const [editingReviewId, setEditingReviewId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Favorite state
  const [isFavorited, setIsFavorited] = useState(false);
  const [favLoading, setFavLoading] = useState(false);

  // Report modal state
  const [showReport, setShowReport] = useState(false);
  const [report, setReport] = useState({ reason: '', description: '' });
  const [reportLoading, setReportLoading] = useState(false);
  const [reportMsg, setReportMsg] = useState('');

  // Roommate request state
  const [roommateState, setRoommateState] = useState({ loading: false, error: null, success: false, sent: false });
  const [existingRequest, setExistingRequest] = useState(null); // { id, status, rejection_reason }
  const [showRoommateModal, setShowRoommateModal] = useState(false);
  const [roommateForm, setRoommateForm] = useState({ message: '', move_in_date: '', occupants: 1, has_pet: false });

  // Appointment form state
  const [showAppt, setShowAppt] = useState(false);
  const [apptDate, setApptDate] = useState('');
  const [apptState, setApptState] = useState({ loading: false, error: null, success: false });

  // Deposit form state
  const [showDeposit, setShowDeposit] = useState(false);
  const [depositForm, setDepositForm] = useState({ amount: '', note: '' });
  const [depositState, setDepositState] = useState({ loading: false, error: null, success: false });

  // Similar rooms
  const [similarRooms, setSimilarRooms] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await roomService.getRoomById(id);
        setRoom(data);
        const primaryIdx = data.room_images?.findIndex(i => i.is_primary);
        if (primaryIdx > 0) setActiveImg(primaryIdx);
      } catch {
        navigate('/rooms', { replace: true });
      } finally {
        setLoading(false);
      }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Fetch similar rooms
  useEffect(() => {
    if (id) {
      roomService.getSimilarRooms(id)
        .then(data => setSimilarRooms(Array.isArray(data) ? data : []))
        .catch(() => setSimilarRooms([]));
    }
  }, [id]);

  // Check existing roommate request
  useEffect(() => {
    if (isAuthenticated && user?.role === 'tenant' && id) {
      roommateRequestService.checkStatus(id)
        .then(res => {
          if (res.data?.request) setExistingRequest(res.data.request);
        })
        .catch(() => {});
    }
  }, [isAuthenticated, user?.role, id]);

  // Check favorite status khi đã đăng nhập
  useEffect(() => {
    if (isAuthenticated && id) {
      favoriteService.checkFavorite(id)
        .then(res => setIsFavorited(res.isFavorited))
        .catch(() => {});
    }
  }, [isAuthenticated, id]);

  // Check review eligibility
  useEffect(() => {
    if (isAuthenticated && user?.role === 'tenant' && id) {
      apiClient.get(`/rooms/${id}/reviews/eligibility`)
        .then(res => setReviewEligibility(res.data))
        .catch(() => {});
    }
  }, [isAuthenticated, user?.role, id]);

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    setSubmitReview({ loading: true, error: null, success: false });
    try {
      if (editingReviewId) {
        // Update existing review
        await apiClient.put(`/rooms/${id}/reviews/${editingReviewId}`, review);
        setSubmitReview({ loading: false, error: null, success: true });
        setEditingReviewId(null);
      } else {
        // Create new review
        await apiClient.post(`/rooms/${id}/reviews`, review);
        setSubmitReview({ loading: false, error: null, success: true });
      }
      setReviewing(false);
      setReview({ rating: 5, comment: '' });
      // Reload room to get new reviews + re-check eligibility
      const data = await roomService.getRoomById(id);
      setRoom(data);
      apiClient.get(`/rooms/${id}/reviews/eligibility`)
        .then(res => setReviewEligibility(res.data))
        .catch(() => {});
    } catch (err) {
      setSubmitReview({ loading: false, error: err.response?.data?.error || 'Lỗi gửi đánh giá.', success: false });
    }
  };

  const handleEditReview = (rev) => {
    setEditingReviewId(rev.id);
    setReview({ rating: rev.rating, comment: rev.comment || '' });
    setReviewing(true);
    setSubmitReview({ loading: false, error: null, success: false });
  };

  const handleDeleteReview = async (reviewId) => {
    setDeleteLoading(true);
    try {
      await apiClient.delete(`/rooms/${id}/reviews/${reviewId}`);
      setDeleteConfirmId(null);
      // Reload room
      const data = await roomService.getRoomById(id);
      setRoom(data);
      // Re-check eligibility
      apiClient.get(`/rooms/${id}/reviews/eligibility`)
        .then(res => setReviewEligibility(res.data))
        .catch(() => {});
    } catch (err) {
      alert(err.response?.data?.error || 'Xóa đánh giá thất bại.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleLandlordResponse = async (rev) => {
    const response = window.prompt('Nhap phan hoi cua chu nha:', rev.landlord_response || '');
    if (!response?.trim()) return;
    try {
      await apiClient.patch(`/rooms/${id}/reviews/${rev.id}/response`, { response: response.trim() });
      setRoom(prev => ({
        ...prev,
        reviews: prev.reviews.map(r => r.id === rev.id ? { ...r, landlord_response: response.trim(), landlord_responded_at: new Date().toISOString() } : r),
      }));
    } catch (err) {
      alert(err.response?.data?.error || 'Khong the phan hoi review.');
    }
  };

  const handleHideReview = async (rev) => {
    const reason = window.prompt('Nhap ly do an review:');
    if (!reason?.trim()) return;
    try {
      await apiClient.patch(`/rooms/${id}/reviews/${rev.id}/moderation`, { is_hidden: true, hidden_reason: reason.trim() });
      setRoom(prev => ({ ...prev, reviews: prev.reviews.filter(r => r.id !== rev.id) }));
    } catch (err) {
      alert(err.response?.data?.error || 'Khong the an review.');
    }
  };

  const handleCancelReview = () => {
    setReviewing(false);
    setEditingReviewId(null);
    setReview({ rating: 5, comment: '' });
    setSubmitReview({ loading: false, error: null, success: false });
  };

  const handleToggleFavorite = async () => {
    if (!isAuthenticated) { navigate('/login'); return; }
    setFavLoading(true);
    try {
      await favoriteService.toggleFavorite(id, isFavorited);
      setIsFavorited(v => !v);
    } catch { /* toggle-fav may fail silently */ } finally { setFavLoading(false); }
  };

  const handleReport = async (e) => {
    e.preventDefault();
    setReportLoading(true);
    try {
      await reportService.createReport({ room_id: id, ...report });
      setReportMsg('✅ Báo cáo đã được gửi. Cảm ơn bạn!');
      setTimeout(() => { setShowReport(false); setReportMsg(''); setReport({ reason: '', description: '' }); }, 2500);
    } catch (err) {
      setReportMsg('❌ ' + (err.response?.data?.error || 'Gửi báo cáo thất bại.'));
    } finally { setReportLoading(false); }
  };

  const handleRoommateRequest = async (e) => {
    e?.preventDefault?.();
    if (!isAuthenticated) { navigate('/login'); return; }
    setRoommateState({ loading: true, error: null, success: false, sent: false });
    try {
      const res = await roommateRequestService.create({
        room_id: id,
        message: roommateForm.message,
        move_in_date: roommateForm.move_in_date || null,
        occupants: roommateForm.occupants,
        has_pet: roommateForm.has_pet,
      });
      setRoommateState({ loading: false, error: null, success: true, sent: true });
      setExistingRequest(res.data?.request || { status: 'pending' });
      setShowRoommateModal(false);
    } catch (err) {
      const msg = err.response?.data?.error || 'Gửi yêu cầu thất bại.';
      setRoommateState({ loading: false, error: msg, success: false, sent: false });
    }
  };

  const handleAppointmentSubmit = async (e) => {
    e.preventDefault();
    if (!apptDate) return;
    setApptState({ loading: true, error: null, success: false });
    try {
      await appointmentService.create(id, new Date(apptDate).toISOString());
      setApptState({ loading: false, error: null, success: true });
      setTimeout(() => { setShowAppt(false); setApptDate(''); setApptState({ loading: false, error: null, success: false }); }, 2000);
    } catch (err) {
      setApptState({ loading: false, error: err.response?.data?.error || 'Đặt lịch thất bại.', success: false });
    }
  };

  const handleDepositSubmit = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) { navigate('/login'); return; }
    setDepositState({ loading: true, error: null, success: false });
    try {
      await depositService.create({
        room_id: id,
        amount: Number(depositForm.amount),
        note: depositForm.note,
      });
      setDepositState({ loading: false, error: null, success: true });
      setTimeout(() => {
        setShowDeposit(false);
        setDepositForm({ amount: '', note: '' });
        setDepositState({ loading: false, error: null, success: false });
      }, 1800);
    } catch (err) {
      setDepositState({ loading: false, error: err.response?.data?.error || 'Gui yeu cau coc that bai.', success: false });
    }
  };

  // Min datetime for appointment: now + 1 hour
  const minDateTime = new Date(Date.now() + 3600_000).toISOString().slice(0, 16);

  const avgRating = () => {
    const reviews = room?.reviews || [];
    if (!reviews.length) return null;
    const sum = reviews.reduce((s, r) => s + r.rating, 0);
    return (sum / reviews.length).toFixed(1);
  };

  const renderStars = (rating, interactive = false) => {
    return (
      <div className={`stars ${interactive ? 'stars--interactive' : ''}`}>
        {[1, 2, 3, 4, 5].map(n => (
          <span
            key={n}
            className={`star ${n <= rating ? 'star--filled' : ''}`}
            onClick={() => interactive && setReview(r => ({ ...r, rating: n }))}
          >
            ★
          </span>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="room-detail-page">
        <div className="container">
          <div className="room-detail-skeleton">
            <div className="skeleton skeleton--gallery" />
            <div className="skeleton skeleton--info" />
          </div>
        </div>
        <style>{styles}</style>
      </div>
    );
  }

  if (!room) return null;

  const images = room.room_images || [];
  const amenities = room.room_amenities?.map(ra => ra.amenities) || [];
  const reviews = room.reviews || [];

  return (
    <div className="room-detail-page">
      <div className="container">
        {/* ── Breadcrumb ── */}
        <nav className="breadcrumb animate-slideUp">
          <Link to="/">Trang chủ</Link>
          <span>›</span>
          <Link to="/rooms">Tìm phòng</Link>
          <span>›</span>
          <span>{room.title}</span>
        </nav>

        {/* ── Gallery + Info ── */}
        <div className="room-detail-layout">
          {/* Gallery */}
          <div className="room-gallery animate-slideUp">
            <div className="gallery-main">
              {images.length > 0 ? (
                <img
                  src={images[activeImg]?.image_url}
                  alt={room.title}
                  className="gallery-main__img"
                />
              ) : (
                <div className="gallery-placeholder">🏠<span>Chưa có ảnh</span></div>
              )}
              {images.length > 1 && (
                <>
                  <button className="gallery-btn gallery-btn--prev" onClick={() => setActiveImg(i => (i - 1 + images.length) % images.length)}>‹</button>
                  <button className="gallery-btn gallery-btn--next" onClick={() => setActiveImg(i => (i + 1) % images.length)}>›</button>
                </>
              )}
              <div className="gallery-counter">{images.length > 0 ? `${activeImg + 1} / ${images.length}` : '0 ảnh'}</div>
            </div>
            {images.length > 1 && (
              <div className="gallery-thumbs">
                {images.map((img, i) => (
                  <button
                    key={i}
                    className={`gallery-thumb ${i === activeImg ? 'gallery-thumb--active' : ''}`}
                    onClick={() => setActiveImg(i)}
                  >
                    <img src={img.image_url} alt="" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info Card */}
          <div className="room-info animate-slideUp" style={{ animationDelay: '0.1s' }}>
            {/* Status */}
            <div className="room-info__status">
              <span className={`badge badge-${room.status}`}>
                {room.status === 'approved' ? '✅ Đã duyệt' : room.status === 'pending' ? '⏳ Chờ duyệt' : '❌ Từ chối'}
              </span>
              {room.is_available && <span className="badge badge-approved">🟢 Còn phòng</span>}
            </div>

            <h1 className="room-info__title">{room.title}</h1>
            <p className="room-info__addr">📍 {room.address}, {room.city}</p>

            {/* Price + Area */}
            <div className="room-info__stats">
              <div className="room-stat">
                <span className="room-stat__label">Giá thuê</span>
                <strong className="room-stat__value room-stat__value--price">{formatPrice(room.price)}<small>/tháng</small></strong>
              </div>
              {room.area && (
                <div className="room-stat">
                  <span className="room-stat__label">Diện tích</span>
                  <strong className="room-stat__value">{room.area} m²</strong>
                </div>
              )}
              {avgRating() && (
                <div className="room-stat">
                  <span className="room-stat__label">Đánh giá</span>
                  <strong className="room-stat__value">⭐ {avgRating()} <small>({reviews.length} review)</small></strong>
                </div>
              )}
            </div>

            {/* Host */}
            <Link to={`/landlords/${room.users?.id}`} className="room-info__host room-info__host--link">
              {room.users?.avatar_url
                ? <img src={room.users.avatar_url} alt="" className="host-avatar-lg" />
                : (
                  <div className="host-avatar-lg host-avatar-lg--fallback">
                    {(room.users?.full_name || 'C')[0]}
                  </div>
                )
              }
              <div>
                <p className="host-name">
                  {room.users?.full_name || 'Chủ nhà'}
                  {room.users?.is_verified && <span className="verified-badge" title="Chủ nhà đã xác minh">✓</span>}
                </p>
                {room.users?.phone && <p className="host-phone">📞 {room.users.phone}</p>}
              </div>
              <span className="host-link-arrow">→</span>
            </Link>

            {/* CTAs */}
            <div className="room-info__cta">
              {/* Favorite button */}
              <button
                id="btn-favorite"
                className={`btn btn-full ${isFavorited ? 'btn-fav-active' : 'btn-secondary'}`}
                onClick={handleToggleFavorite}
                disabled={favLoading}
              >
                {isFavorited ? '❤️ Đã yêu thích' : '🤍 Thêm yêu thích'}
              </button>

              {isAuthenticated ? (
                <>
                  <a
                    id="btn-contact-landlord"
                    href={room.users?.phone ? `tel:${room.users.phone}` : '#'}
                    className="btn btn-primary btn-full"
                  >
                    📞 Liên hệ chủ nhà
                  </a>
                  {/* Chat button – chỉ hiện với tenant, không phải chủ nhà */}
                  {user?.role === 'tenant' && room.users?.id !== user?.id && (
                    <Link
                      id="btn-chat-landlord"
                      to={`/chat?landlord=${room.users?.id}&room=${room.id}`}
                      className="btn btn-secondary btn-full"
                    >
                      💬 Nhắn tin cho chủ nhà
                    </Link>
                  )}
                  {user?.role === 'tenant' && reviewEligibility.eligible && !reviewEligibility.already_reviewed && (
                    <button id="btn-write-review" className="btn btn-secondary btn-full" onClick={() => { setEditingReviewId(null); setReview({ rating: 5, comment: '' }); setReviewing(r => !r); }}>
                      ✍️ Viết đánh giá
                    </button>
                  )}
                  {user?.role === 'tenant' && !reviewEligibility.eligible && (
                    <div className="review-eligibility-hint">
                      💡 Bạn cần có lịch hẹn hoàn thành hoặc yêu cầu ở ghép được chấp nhận để viết đánh giá.
                    </div>
                  )}
                  <button
                    id="btn-report-room"
                    className="btn btn-ghost btn-full btn-danger-ghost"
                    onClick={() => setShowReport(true)}
                  >
                    🚨 Báo cáo vi phạm
                  </button>
                </>
              ) : (
                <Link to="/login" id="btn-login-to-contact" className="btn btn-primary btn-full">
                  🔑 Đăng nhập để liên hệ
                </Link>
              )}
            </div>

            {/* Posted date */}
            <p className="room-info__date">Đăng ngày {formatDate(room.created_at)}</p>
          </div>
        </div>

        {/* ── Description ── */}
        <section className="room-section animate-fadeIn">
          <h2 className="room-section__title">📋 Mô tả</h2>
          <div className="room-desc">
            {room.description ? (
              room.description.split('\n').map((line, i) => <p key={i}>{line}</p>)
            ) : (
              <p className="text-muted">Chưa có mô tả.</p>
            )}
          </div>
        </section>

        {/* ── Amenities ── */}
        {amenities.length > 0 && (
          <section className="room-section animate-fadeIn">
            <h2 className="room-section__title">🛋️ Tiện ích</h2>
            <div className="amenities-grid">
              {amenities.map(a => (
                <div key={a?.id} className="amenity-chip">
                  <span className="amenity-chip__icon">✓</span>
                  {a?.name}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Review Form ── */}
        {reviewing && isAuthenticated && (
          <section className="room-section animate-scaleIn">
            <h2 className="room-section__title">
              {editingReviewId ? '✏️ Chỉnh sửa đánh giá' : '✍️ Viết đánh giá của bạn'}
            </h2>
            <form className="review-form" onSubmit={handleReviewSubmit}>
              <div className="form-group">
                <label className="form-label">Đánh giá sao</label>
                {renderStars(review.rating, true)}
              </div>
              <div className="form-group">
                <label className="form-label">Nhận xét</label>
                <textarea
                  id="review-comment"
                  className="form-input review-textarea"
                  placeholder="Chia sẻ trải nghiệm của bạn về phòng này..."
                  value={review.comment}
                  onChange={e => setReview(r => ({ ...r, comment: e.target.value }))}
                  rows={4}
                />
              </div>
              {submitReview.error && <p className="form-error">{submitReview.error}</p>}
              {submitReview.success && (
                <p style={{ color: 'var(--success)', fontSize: 14 }}>
                  {editingReviewId ? '✅ Đã cập nhật đánh giá!' : '✅ Đã gửi đánh giá!'}
                </p>
              )}
              <div style={{ display: 'flex', gap: 12 }}>
                <button id="btn-submit-review" type="submit" className="btn btn-primary" disabled={submitReview.loading}>
                  {submitReview.loading ? 'Đang gửi...' : editingReviewId ? '💾 Cập nhật' : 'Gửi đánh giá'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={handleCancelReview}>Hủy</button>
              </div>
            </form>
          </section>
        )}

        {/* ── Roommate Request ── */}
        {isAuthenticated && user?.role === 'tenant' && room.status === 'approved' && room.is_hidden !== true && (
          <section className="room-section animate-fadeIn">
            <h2 className="room-section__title">🤝 Yêu cầu ở ghép</h2>
            <div className="roommate-box">
              <div className="roommate-box__info">
                <span className="roommate-box__icon">🏘️</span>
                <div>
                  <p className="roommate-box__title">Ở ghép phòng này</p>
                  <p className="roommate-box__desc">
                    Gửi yêu cầu kèm lời nhắn giới thiệu để chủ nhà xem xét.
                  </p>
                  {room.available_slots !== undefined && (
                    <p className="roommate-box__slots">
                      📊 Còn <strong>{room.available_slots}</strong> chỗ ở ghép
                    </p>
                  )}
                </div>
              </div>

              {/* Hết chỗ */}
              {(!room.is_available || room.available_slots === 0) && !existingRequest ? (
                <div className="roommate-full">
                  <span>🚫</span> Phòng hiện đã hết chỗ ở ghép.
                </div>
              ) : existingRequest?.status === 'accepted' ? (
                <div className="roommate-accepted">
                  <span>✅</span>
                  <div>
                    <p><strong>Yêu cầu đã được chấp nhận!</strong></p>
                    <p>Bạn có thể nhắn tin với chủ nhà để sắp xếp chi tiết.</p>
                  </div>
                  <Link to="/chat" className="btn btn-primary btn-sm">💬 Nhắn tin</Link>
                </div>
              ) : existingRequest?.status === 'rejected' ? (
                <div className="roommate-rejected">
                  <span>❌</span>
                  <div>
                    <p><strong>Yêu cầu đã bị từ chối</strong></p>
                    {existingRequest.rejection_reason && (
                      <p className="roommate-rejection-reason">Lý do: <em>{existingRequest.rejection_reason}</em></p>
                    )}
                  </div>
                </div>
              ) : existingRequest?.status === 'pending' || roommateState.success ? (
                <div className="roommate-pending">
                  <span>⏳</span>
                  <div>
                    <p><strong>Đang chờ chủ nhà phản hồi</strong></p>
                    <p>Yêu cầu của bạn đã được gửi. Vui lòng chờ chủ nhà xem xét.</p>
                  </div>
                </div>
              ) : (
                <>
                  {roommateState.error && <p className="form-error">{roommateState.error}</p>}
                  <button
                    id="btn-roommate-request"
                    className="btn btn-primary"
                    onClick={() => setShowRoommateModal(true)}
                  >
                    🤝 Gửi yêu cầu ở ghép
                  </button>
                </>
              )}
            </div>
          </section>
        )}

        {/* ── Roommate Request Modal ── */}
        {showRoommateModal && (
          <div className="modal-overlay animate-fadeIn" onClick={() => setShowRoommateModal(false)}>
            <div className="modal-box animate-scaleIn" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
              <div className="modal-box__header">
                <h3>🤝 Gửi yêu cầu ở ghép</h3>
                <button className="modal-close" onClick={() => setShowRoommateModal(false)}>✕</button>
              </div>
              <form onSubmit={handleRoommateRequest} className="roommate-form">
                <div className="form-group">
                  <label className="form-label">Lời nhắn giới thiệu</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    placeholder="Xin chào, tôi là sinh viên năm 3 ĐH Bách Khoa, muốn tìm phòng ở ghép..."
                    value={roommateForm.message}
                    onChange={e => setRoommateForm(f => ({ ...f, message: e.target.value }))}
                  />
                </div>
                <div className="roommate-form__row">
                  <div className="form-group">
                    <label className="form-label">📅 Ngày muốn chuyển vào</label>
                    <input
                      type="date" className="form-input"
                      value={roommateForm.move_in_date}
                      onChange={e => setRoommateForm(f => ({ ...f, move_in_date: e.target.value }))}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">👥 Số người ở</label>
                    <input
                      type="number" className="form-input" min={1} max={10}
                      value={roommateForm.occupants}
                      onChange={e => setRoommateForm(f => ({ ...f, occupants: +e.target.value }))}
                    />
                  </div>
                </div>
                <label className="roommate-form__pet">
                  <input
                    type="checkbox"
                    checked={roommateForm.has_pet}
                    onChange={e => setRoommateForm(f => ({ ...f, has_pet: e.target.checked }))}
                  />
                  <span>🐾 Có nuôi thú cưng</span>
                </label>
                {roommateState.error && <p className="form-error">{roommateState.error}</p>}
                <div className="modal-actions">
                  <button type="submit" className="btn btn-primary" disabled={roommateState.loading}>
                    {roommateState.loading ? 'Đang gửi...' : '🤝 Gửi yêu cầu'}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setShowRoommateModal(false)}>Hủy</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Appointment Booking ── */}
        {isAuthenticated && user?.role === 'tenant' && room.status === 'approved' && room.is_hidden !== true && room.is_available !== false && (
          <section className="room-section animate-fadeIn">
            <h2 className="room-section__title">📅 Đặt lịch xem phòng</h2>
            {!showAppt ? (
              <button
                id="btn-show-appointment"
                className="btn btn-secondary"
                onClick={() => setShowAppt(true)}
              >
                📅 Đặt lịch hẹn với chủ nhà
              </button>
            ) : (
              <form className="appt-form" onSubmit={handleAppointmentSubmit}>
                <div className="form-group">
                  <label className="form-label">🕐 Chọn ngày & giờ hẹn</label>
                  <input
                    id="appt-datetime"
                    type="datetime-local"
                    className="form-input"
                    value={apptDate}
                    onChange={e => setApptDate(e.target.value)}
                    min={minDateTime}
                    required
                  />
                </div>
                {apptState.error && <p className="form-error">{apptState.error}</p>}
                {apptState.success && <p style={{color:'var(--success)', fontSize:14}}>✅ Đã đặt lịch thành công!</p>}
                <div style={{display:'flex', gap:12}}>
                  <button id="btn-submit-appointment" type="submit" className="btn btn-primary" disabled={apptState.loading}>
                    {apptState.loading ? 'Đang đặt...' : '📅 Xác nhận đặt lịch'}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setShowAppt(false)}>Hủy</button>
                </div>
              </form>
            )}
          </section>
        )}

        {/* ── Reviews ── */}
        {isAuthenticated && user?.role === 'tenant' && room.status === 'approved' && room.is_hidden !== true && room.is_available !== false && (
          <section className="room-section animate-fadeIn">
            <h2 className="room-section__title">Coc / giu phong</h2>
            <div className="deposit-box">
              <div>
                <p className="deposit-box__title">Coc / giu phong</p>
                <p className="deposit-box__desc">Chi tenant co request accepted hoac lich hen hop le moi duoc gui yeu cau coc.</p>
              </div>
              {!showDeposit ? (
                <button className="btn btn-primary" onClick={() => {
                  setDepositForm(f => ({ ...f, amount: f.amount || room.price || '' }));
                  setShowDeposit(true);
                }}>
                  Gui yeu cau coc
                </button>
              ) : (
                <form className="deposit-inline-form" onSubmit={handleDepositSubmit}>
                  <input
                    type="number"
                    className="form-input"
                    min={1}
                    value={depositForm.amount}
                    onChange={e => setDepositForm(f => ({ ...f, amount: e.target.value }))}
                    required
                    placeholder="So tien coc"
                  />
                  <input
                    className="form-input"
                    value={depositForm.note}
                    onChange={e => setDepositForm(f => ({ ...f, note: e.target.value }))}
                    placeholder="Ghi chu"
                  />
                  {depositState.error && <p className="form-error">{depositState.error}</p>}
                  {depositState.success && <p style={{color:'var(--success)', fontSize:14}}>Da gui yeu cau coc phong.</p>}
                  <div style={{display:'flex', gap:8}}>
                    <button type="submit" className="btn btn-primary btn-sm" disabled={depositState.loading}>
                      {depositState.loading ? 'Dang gui...' : 'Gui coc'}
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowDeposit(false)}>Huy</button>
                  </div>
                </form>
              )}
            </div>
          </section>
        )}

        <section className="room-section animate-fadeIn">
          <h2 className="room-section__title">
            ⭐ Đánh giá {reviews.length > 0 && `(${reviews.length})`}
          </h2>
            {reviews.length === 0 ? (
            <div className="reviews-empty">
              <p>Chưa có đánh giá nào.{reviewEligibility.eligible ? ' Hãy là người đầu tiên!' : ''}</p>
            </div>
          ) : (
            <div className="reviews-list">
              {reviews.map(rev => {
                const isOwn = isAuthenticated && rev.user_id === user?.id;
                return (
                  <div key={rev.id} className={`review-card ${isOwn ? 'review-card--own' : ''}`}>
                    <div className="review-card__header">
                      <div className="review-card__user">
                        {rev.users?.avatar_url
                          ? <img src={rev.users.avatar_url} alt="" className="review-avatar" />
                          : (
                            <div className="review-avatar review-avatar--fallback">
                              {(rev.users?.full_name || 'U')[0]}
                            </div>
                          )
                        }
                        <div>
                          <strong>
                            {rev.users?.full_name || 'Người dùng'}
                            {isOwn && <span className="review-own-badge">Bạn</span>}
                          </strong>
                          <p className="review-date">
                            {formatDate(rev.created_at)}
                            {rev.updated_at && rev.updated_at !== rev.created_at && (
                              <span className="review-edited"> · đã chỉnh sửa</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="review-card__right">
                        {renderStars(rev.rating)}
                        {isOwn && (
                          <div className="review-card__actions">
                            <button
                              className="review-action-btn review-action-btn--edit"
                              title="Sửa đánh giá"
                              onClick={() => handleEditReview(rev)}
                            >✏️</button>
                            <button
                              className="review-action-btn review-action-btn--delete"
                              title="Xóa đánh giá"
                              onClick={() => setDeleteConfirmId(rev.id)}
                            >🗑️</button>
                          </div>
                        )}
                      </div>
                    </div>
                    {rev.comment && <p className="review-comment">{rev.comment}</p>}
                    {rev.landlord_response && (
                      <div className="review-landlord-response">
                        <strong>Phản hồi của chủ nhà:</strong>
                        <p>{rev.landlord_response}</p>
                      </div>
                    )}
                    {isAuthenticated && user?.role === 'landlord' && room.host_id === user.id && (
                      <button type="button" className="review-action-btn review-action-btn--edit" onClick={() => handleLandlordResponse(rev)}>
                        {rev.landlord_response ? 'Sửa phản hồi' : 'Phản hồi'}
                      </button>
                    )}
                    {isAuthenticated && user?.role === 'admin' && (
                      <button type="button" className="review-action-btn review-action-btn--delete" onClick={() => handleHideReview(rev)}>
                        Ẩn review
                      </button>
                    )}

                    {/* Delete confirmation */}
                    {deleteConfirmId === rev.id && (
                      <div className="review-delete-confirm">
                        <p>Bạn có chắc muốn xóa đánh giá này?</p>
                        <div className="review-delete-confirm__actions">
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDeleteReview(rev.id)}
                            disabled={deleteLoading}
                          >
                            {deleteLoading ? 'Đang xóa...' : '🗑️ Xóa'}
                          </button>
                          <button
                            className="btn btn-sm btn-ghost"
                            onClick={() => setDeleteConfirmId(null)}
                          >Hủy</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Similar Rooms ── */}
        {similarRooms.length > 0 && (
          <section className="room-section animate-fadeIn">
            <h2 className="room-section__title">🏠 Phòng tương tự</h2>
            <div className="similar-grid">
              {similarRooms.map(sr => {
                const sImg = sr.room_images?.find(x => x.is_primary) || sr.room_images?.[0];
                return (
                  <Link key={sr.id} to={`/rooms/${sr.id}`} className="similar-card">
                    <div className="similar-card__img">
                      {sImg ? <img src={sImg.image_url} alt={sr.title} /> : <div className="similar-card__placeholder">🏠</div>}
                    </div>
                    <div className="similar-card__body">
                      <h4 className="similar-card__title">{sr.title}</h4>
                      <p className="similar-card__addr">📍 {sr.address}, {sr.city}</p>
                      <p className="similar-card__price">{formatCurrency(sr.price)}/tháng</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* ── Report Modal ── */}
      {showReport && (
        <div className="modal-overlay" onClick={() => setShowReport(false)}>
          <div className="modal-box animate-scaleIn" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🚨 Báo cáo phòng này</h3>
              <button className="modal-close" onClick={() => setShowReport(false)}>✕</button>
            </div>
            <form onSubmit={handleReport} className="modal-form">
              <div className="form-group">
                <label className="form-label">Lý do báo cáo <span style={{color:'#ef4444'}}>*</span></label>
                <select
                  className="form-input"
                  value={report.reason}
                  onChange={e => setReport(r => ({ ...r, reason: e.target.value }))}
                  required
                >
                  <option value="">-- Chọn lý do --</option>
                  <option value="Thông tin sai lệch">Thông tin sai lệch</option>
                  <option value="Ảnh giả mạo">Ảnh giả mạo</option>
                  <option value="Giá không đúng">Giá không đúng</option>
                  <option value="Nội dung không phù hợp">Nội dung không phù hợp</option>
                  <option value="Lừa đảo">Lừa đảo</option>
                  <option value="Phòng đã cho thuê">Phòng đã cho thuê</option>
                  <option value="Khác">Khác</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Mô tả chi tiết (tùy chọn)</label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="Mô tả thêm về vấn đề..."
                  value={report.description}
                  onChange={e => setReport(r => ({ ...r, description: e.target.value }))}
                  style={{ resize: 'vertical' }}
                />
              </div>
              {reportMsg && (
                <p style={{ fontSize: 14, color: reportMsg.startsWith('✅') ? '#10b981' : '#ef4444' }}>
                  {reportMsg}
                </p>
              )}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowReport(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary" disabled={reportLoading}>
                  {reportLoading ? 'Đang gửi...' : '🚨 Gửi báo cáo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{styles}</style>
    </div>
  );
};

const styles = `
  .room-detail-page { padding: 28px 0 64px; }

  /* Breadcrumb */
  .breadcrumb { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-muted); margin-bottom: 24px; }
  .breadcrumb a { color: var(--text-secondary); transition: var(--transition); }
  .breadcrumb a:hover { color: var(--primary); }

  /* Layout */
  .room-detail-layout {
    display: grid; grid-template-columns: 1fr 380px; gap: 28px; margin-bottom: 48px;
  }
  @media(max-width: 1024px) { .room-detail-layout { grid-template-columns: 1fr; } }

  /* Gallery */
  .gallery-main {
    position: relative; border-radius: var(--radius-lg); overflow: hidden;
    background: var(--bg-inset); height: 420px;
  }
  .gallery-main__img { width: 100%; height: 100%; object-fit: cover; transition: transform .4s var(--ease-out); }
  .gallery-placeholder {
    height: 100%; display: flex; flex-direction: column; align-items: center;
    justify-content: center; gap: 8px; font-size: 56px; color: var(--text-muted);
  }
  .gallery-placeholder span { font-size: 14px; }
  .gallery-btn {
    position: absolute; top: 50%; transform: translateY(-50%);
    background: rgba(26,35,50,.5); backdrop-filter: blur(8px);
    color: #fff; border: none;
    width: 40px; height: 40px; border-radius: 50%;
    font-size: 20px; display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: var(--transition);
  }
  .gallery-btn:hover { background: rgba(26,35,50,.75); }
  .gallery-btn--prev { left: 12px; }
  .gallery-btn--next { right: 12px; }
  .gallery-counter {
    position: absolute; bottom: 12px; right: 12px;
    background: rgba(26,35,50,.6); backdrop-filter: blur(8px); color: #fff;
    padding: 4px 12px; border-radius: var(--radius-full); font-size: 12px; font-weight: 500;
  }
  .gallery-thumbs { display: flex; gap: 8px; margin-top: 12px; overflow-x: auto; padding-bottom: 4px; }
  .gallery-thumb {
    flex-shrink: 0; width: 72px; height: 52px; border-radius: var(--radius-sm);
    overflow: hidden; border: 2px solid transparent; cursor: pointer; transition: var(--transition);
  }
  .gallery-thumb img { width: 100%; height: 100%; object-fit: cover; }
  .gallery-thumb--active { border-color: var(--primary); }
  .gallery-thumb:hover { border-color: var(--border-hover); }

  /* Info Card */
  .room-info {
    background: var(--bg-card); border: 1px solid var(--border);
    border-radius: var(--radius-lg); padding: 24px;
    display: flex; flex-direction: column; gap: 16px;
    height: fit-content; position: sticky; top: 76px;
    box-shadow: var(--shadow-sm);
  }
  .room-info__status { display: flex; gap: 8px; flex-wrap: wrap; }
  .room-info__title { font-size: 19px; font-weight: 800; color: var(--text-primary); line-height: 1.3; }
  .room-info__addr { font-size: 14px; color: var(--text-secondary); }
  .room-info__stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .room-stat {
    display: flex; flex-direction: column; gap: 3px;
    padding: 14px; background: var(--bg-warm); border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
  }
  .room-stat__label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600; }
  .room-stat__value { font-size: 16px; font-weight: 700; color: var(--text-primary); font-variant-numeric: tabular-nums; }
  .room-stat__value--price { color: var(--primary); font-size: 20px; }
  .room-stat__value small { font-size: 12px; font-weight: 400; color: var(--text-secondary); }
  .room-info__host {
    display: flex; align-items: center; gap: 12px;
    padding: 14px; background: var(--bg-warm); border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
  }
  .host-avatar-lg { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
  .host-avatar-lg--fallback {
    display: flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);
    color: #fff; font-size: 18px; font-weight: 800;
  }
  .room-info__host--link { cursor: pointer; transition: var(--transition); text-decoration: none; }
  .room-info__host--link:hover { border-color: var(--primary); background: var(--primary-50); }
  .host-name { font-weight: 600; color: var(--text-primary); font-size: 14px; display: flex; align-items: center; gap: 6px; }
  .host-phone { font-size: 13px; color: var(--text-secondary); margin-top: 2px; }
  .host-link-arrow { margin-left: auto; color: var(--text-muted); font-size: 16px; transition: var(--transition); }
  .room-info__host--link:hover .host-link-arrow { color: var(--primary); transform: translateX(2px); }
  .verified-badge {
    display: inline-flex; align-items: center; justify-content: center;
    width: 18px; height: 18px; border-radius: 50%;
    background: var(--primary); color: #fff; font-size: 10px; font-weight: 800;
  }
  .roommate-full {
    padding: 12px 16px; background: rgba(239,68,68,.06);
    border: 1px solid rgba(239,68,68,.15); border-radius: var(--radius-md);
    color: var(--danger); font-size: 13px; font-weight: 600;
    display: flex; align-items: center; gap: 8px;
  }
  .roommate-accepted {
    padding: 14px 16px; background: rgba(16,185,129,.06);
    border: 1px solid rgba(16,185,129,.2); border-radius: var(--radius-md);
    display: flex; align-items: center; gap: 12px;
    color: var(--success); font-size: 13px;
  }
  .roommate-accepted strong { color: var(--text-primary); }
  .roommate-accepted span { font-size: 24px; }
  .roommate-rejected {
    padding: 14px 16px; background: rgba(239,68,68,.05);
    border: 1px solid rgba(239,68,68,.15); border-radius: var(--radius-md);
    display: flex; align-items: center; gap: 12px;
    color: var(--text-secondary); font-size: 13px;
  }
  .roommate-rejected strong { color: var(--text-primary); }
  .roommate-rejected span { font-size: 24px; }
  .roommate-rejection-reason { margin-top: 4px; font-style: italic; color: var(--text-muted); }
  .roommate-pending {
    padding: 14px 16px; background: rgba(245,158,11,.06);
    border: 1px solid rgba(245,158,11,.2); border-radius: var(--radius-md);
    display: flex; align-items: center; gap: 12px;
    color: var(--text-secondary); font-size: 13px;
  }
  .roommate-pending strong { color: var(--text-primary); }
  .roommate-pending span { font-size: 24px; }
  .roommate-form { padding: 20px 24px; display: flex; flex-direction: column; gap: 14px; }
  .roommate-form__row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  @media(max-width:500px) { .roommate-form__row { grid-template-columns: 1fr; } }
  .roommate-form__pet {
    display: flex; align-items: center; gap: 8px;
    font-size: 14px; cursor: pointer; color: var(--text-secondary); font-weight: 500;
  }
  .roommate-form__pet input { width: 16px; height: 16px; accent-color: var(--primary); cursor: pointer; }
  .modal-actions { display: flex; gap: 10px; padding-top: 4px; }
  .modal-box__header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 20px 24px; border-bottom: 1px solid var(--border);
  }
  .modal-box__header h3 { font-size: 18px; font-weight: 700; color: var(--text-primary); }
  .modal-box {
    background: var(--bg-card); border: 1px solid var(--border);
    border-radius: var(--radius-xl); width: 100%;
    box-shadow: var(--shadow-lg); max-height: 90vh; overflow-y: auto;
  }
  .room-info__cta { display: flex; flex-direction: column; gap: 8px; }
  .room-info__date { font-size: 12px; color: var(--text-muted); text-align: center; }

  /* Sections */
  .room-section { margin-bottom: 36px; }
  .room-section__title {
    font-size: 17px; font-weight: 700; color: var(--text-primary);
    margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--border);
    letter-spacing: -0.01em;
  }
  .room-desc p { color: var(--text-secondary); line-height: 1.8; margin-bottom: 8px; max-width: 65ch; }
  .text-muted { color: var(--text-muted) !important; }

  /* Amenities */
  .amenities-grid { display: flex; flex-wrap: wrap; gap: 8px; }
  .amenity-chip {
    display: flex; align-items: center; gap: 6px;
    padding: 8px 14px; border-radius: var(--radius-md);
    background: var(--bg-warm); border: 1px solid var(--border-subtle);
    font-size: 13px; color: var(--text-primary); transition: var(--transition);
  }
  .amenity-chip:hover { border-color: var(--primary); background: var(--primary-50); }
  .amenity-chip__icon { color: var(--primary); font-weight: 800; font-size: 12px; }

  /* Review form */
  .review-form {
    background: var(--bg-warm); border: 1px solid var(--border);
    border-radius: var(--radius-lg); padding: 24px;
    display: flex; flex-direction: column; gap: 16px;
  }
  .review-textarea { resize: vertical; min-height: 100px; }
  .stars { display: flex; gap: 4px; }
  .star { font-size: 24px; cursor: pointer; color: var(--text-muted); transition: color 0.15s ease; }
  .star--filled { color: var(--accent); }
  .stars--interactive .star:hover { color: var(--accent-light); }

   /* Reviews */
  .reviews-empty {
    text-align: center; padding: 40px; background: var(--bg-warm);
    border: 1px dashed var(--border); border-radius: var(--radius-lg);
    color: var(--text-secondary); font-size: 14px;
  }
  .reviews-list { display: flex; flex-direction: column; gap: 12px; }
  .review-card {
    background: var(--bg-warm); border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md); padding: 18px;
    transition: var(--transition);
  }
  .review-card:hover { border-color: var(--border-hover); }
  .review-card--own {
    border-left: 3px solid var(--primary);
    background: linear-gradient(135deg, var(--bg-warm) 0%, rgba(var(--primary-rgb, 99,102,241), 0.03) 100%);
  }
  .review-card__header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
  .review-card__user { display: flex; align-items: center; gap: 12px; }
  .review-card__right { display: flex; align-items: center; gap: 12px; }
  .review-avatar { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; }
  .review-avatar--fallback {
    display: flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);
    color: #fff; font-size: 14px; font-weight: 700;
  }
  .review-date { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
  .review-edited { font-style: italic; color: var(--text-muted); font-size: 11px; }
  .review-comment { color: var(--text-secondary); font-size: 14px; line-height: 1.7; }
  .review-landlord-response { margin-top:10px; padding:10px 12px; border-left:3px solid var(--primary); background:var(--bg-surface); border-radius:var(--radius-sm); font-size:13px; color:var(--text-secondary); }
  .review-landlord-response strong { display:block; color:var(--text-primary); margin-bottom:4px; }

  /* Review own badge */
  .review-own-badge {
    display: inline-flex; align-items: center;
    margin-left: 8px; padding: 1px 8px;
    background: var(--primary-50, rgba(99,102,241,.08));
    color: var(--primary); font-size: 10px; font-weight: 700;
    border-radius: var(--radius-full); letter-spacing: 0.02em;
    text-transform: uppercase;
  }

  /* Review action buttons */
  .review-card__actions {
    display: flex; gap: 4px;
  }
  .review-action-btn {
    display: flex; align-items: center; justify-content: center;
    width: 32px; height: 32px; border-radius: var(--radius-sm);
    border: 1px solid transparent; background: transparent;
    cursor: pointer; font-size: 14px; transition: var(--transition);
  }
  .review-action-btn--edit:hover {
    background: var(--primary-50, rgba(99,102,241,.08));
    border-color: var(--primary);
  }
  .review-action-btn--delete:hover {
    background: rgba(239,68,68,.06);
    border-color: rgba(239,68,68,.25);
  }

  /* Review delete confirmation */
  .review-delete-confirm {
    margin-top: 12px; padding: 12px 16px;
    background: rgba(239,68,68,.04);
    border: 1px solid rgba(239,68,68,.15);
    border-radius: var(--radius-md);
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; flex-wrap: wrap;
  }
  .review-delete-confirm p {
    font-size: 13px; color: var(--text-secondary); font-weight: 500;
  }
  .review-delete-confirm__actions {
    display: flex; gap: 8px;
  }
  .btn-sm { padding: 6px 14px; font-size: 12px; border-radius: var(--radius-sm); }
  .btn-danger {
    background: #ef4444; color: #fff; border: none; cursor: pointer;
    font-weight: 600; transition: var(--transition);
  }
  .btn-danger:hover { background: #dc2626; }
  .btn-danger:disabled { opacity: 0.6; cursor: not-allowed; }

  /* Review eligibility hint */
  .review-eligibility-hint {
    font-size: 12px; color: var(--text-muted);
    padding: 10px 14px;
    background: var(--bg-warm);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    line-height: 1.5;
  }


  /* Skeleton */
  .room-detail-skeleton { display: grid; grid-template-columns: 1fr 380px; gap: 28px; }
  @media(max-width: 1024px) { .room-detail-skeleton { grid-template-columns: 1fr; } }
  .skeleton {
    border-radius: var(--radius-lg);
    background: linear-gradient(90deg, var(--bg-hover) 25%, var(--border) 50%, var(--bg-hover) 75%);
    background-size: 200% 100%; animation: shimmer 1.5s infinite;
  }
  .skeleton--gallery { height: 420px; }
  .skeleton--info { height: 400px; }

  /* Roommate & Appointment forms */
  .roommate-box {
    background: var(--bg-warm); border: 1px solid var(--border);
    border-radius: var(--radius-lg); padding: 24px;
    display: flex; flex-direction: column; gap: 16px;
  }
  .roommate-box__info { display: flex; gap: 16px; align-items: flex-start; }
  .roommate-box__icon { font-size: 32px; flex-shrink: 0; }
  .roommate-box__title { font-size: 15px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
  .roommate-box__desc { font-size: 13px; color: var(--text-secondary); line-height: 1.6; }
  .roommate-box__slots { font-size: 13px; color: var(--primary-dark); margin-top: 6px; font-weight: 600; }
  .roommate-success { color: var(--success); font-size: 14px; font-weight: 600; }
  .appt-form {
    background: var(--bg-warm); border: 1px solid var(--border);
    border-radius: var(--radius-lg); padding: 24px;
    display: flex; flex-direction: column; gap: 16px;
  }
  .deposit-box {
    background: var(--bg-warm); border: 1px solid var(--border);
    border-radius: var(--radius-lg); padding: 18px;
    display: flex; align-items: center; justify-content: space-between;
    gap: 16px; margin-bottom: 18px;
  }
  .deposit-box__title { font-size: 15px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
  .deposit-box__desc { font-size: 13px; color: var(--text-secondary); line-height: 1.5; }
  .deposit-inline-form { display: grid; grid-template-columns: 140px 1fr auto; align-items: center; gap: 8px; width: 100%; }
  .deposit-inline-form .form-error { grid-column: 1 / -1; }
  @media(max-width:700px) {
    .deposit-box { flex-direction: column; align-items: stretch; }
    .deposit-inline-form { grid-template-columns: 1fr; }
  }

  /* Favorite & Report buttons */
  .btn-fav-active { background: rgba(239,68,68,.08); color: var(--danger); border: 1.5px solid rgba(239,68,68,.25); }
  .btn-fav-active:hover { background: rgba(239,68,68,.14); }
  .btn-danger-ghost { color: var(--text-muted); }
  .btn-danger-ghost:hover { color: var(--danger); background: var(--danger-light); }

  /* Modal */
  .modal-overlay {
    position: fixed; inset: 0; z-index: var(--z-modal);
    background: var(--bg-overlay);
    backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center; padding: 16px;
  }
  .modal-box {
    background: var(--bg-card); border: 1px solid var(--border);
    border-radius: var(--radius-xl); width: 100%; max-width: 460px;
    box-shadow: var(--shadow-xl);
  }
  .modal-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 20px 24px; border-bottom: 1px solid var(--border);
  }
  .modal-header h3 { font-size: 16px; font-weight: 700; color: var(--text-primary); }
  .modal-close {
    background: none; border: none; cursor: pointer;
    font-size: 18px; color: var(--text-muted); padding: 4px 8px;
    border-radius: var(--radius-sm); transition: var(--transition);
  }
  .modal-close:hover { background: var(--bg-hover); color: var(--text-primary); }
  .modal-form { padding: 24px; display: flex; flex-direction: column; gap: 16px; }

  /* Similar rooms */
  .similar-grid {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;
  }
  @media(max-width: 1024px) { .similar-grid { grid-template-columns: repeat(2, 1fr); } }
  @media(max-width: 600px)  { .similar-grid { grid-template-columns: 1fr; } }
  .similar-card {
    background: var(--bg-card); border: 1px solid var(--border);
    border-radius: var(--radius-md); overflow: hidden;
    transition: var(--transition); display: flex; flex-direction: column;
  }
  .similar-card:hover { border-color: var(--border-hover); box-shadow: var(--shadow-sm); transform: translateY(-2px); }
  .similar-card__img { aspect-ratio: 16/9; overflow: hidden; background: var(--bg-inset); }
  .similar-card__img img { width: 100%; height: 100%; object-fit: cover; transition: transform .3s; }
  .similar-card:hover .similar-card__img img { transform: scale(1.04); }
  .similar-card__placeholder { height: 100%; display: flex; align-items: center; justify-content: center; font-size: 32px; color: var(--text-muted); }
  .similar-card__body { padding: 12px; display: flex; flex-direction: column; gap: 4px; }
  .similar-card__title { font-size: 13px; font-weight: 600; color: var(--text-primary); line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .similar-card__addr { font-size: 11px; color: var(--text-muted); }
  .similar-card__price { font-size: 13px; font-weight: 700; color: var(--primary); }

  @media (max-width: 768px) {
    .room-detail-layout { gap: 24px; }
    .gallery-main { height: 280px; }
    .room-info { position: static; }
    .room-info__stats { grid-template-columns: 1fr 1fr; }
  }
`;

export default RoomDetail;
