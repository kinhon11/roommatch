import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { roomService } from '../../services/roomService';
import { supabase } from '../../services/supabaseClient';
import { geminiService } from '../../services/geminiService';
import { useDialog } from '../../context/DialogContext';
import { useToast } from '../../context/ToastContext';

const CITIES = ['Hà Nội', 'Hồ Chí Minh', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ', 'Huế', 'Nha Trang', 'Biên Hòa', 'Vũng Tàu'];
const PAYMENT_CYCLES = [
  { value: 'monthly', label: 'Hàng tháng' },
  { value: 'quarterly', label: 'Theo quý' },
  { value: 'negotiable', label: 'Thỏa thuận' },
];
const ROOMMATE_GENDER_OPTIONS = [
  { value: 'any', label: 'Không yêu cầu' },
  { value: 'male', label: 'Phòng nam' },
  { value: 'female', label: 'Phòng nữ' },
];
const ROOMMATE_OCCUPATION_OPTIONS = [
  { value: 'any', label: 'Không yêu cầu' },
  { value: 'student', label: 'Ưu tiên sinh viên' },
  { value: 'office_worker', label: 'Ưu tiên nhân viên văn phòng' },
  { value: 'worker', label: 'Ưu tiên người đi làm' },
  { value: 'other', label: 'Khác' },
];
const ROOMMATE_SCHEDULE_OPTIONS = [
  { value: 'flexible', label: 'Linh hoạt' },
  { value: 'student', label: 'Theo giờ sinh viên' },
  { value: 'office', label: 'Giờ hành chính' },
  { value: 'shift', label: 'Làm theo ca' },
  { value: 'night', label: 'Có người về khuya / ca đêm' },
  { value: 'other', label: 'Khác' },
];
const ROOMMATE_CLEANLINESS_OPTIONS = [
  { value: 'normal', label: 'Bình thường' },
  { value: 'tidy', label: 'Gọn gàng' },
  { value: 'very_tidy', label: 'Rất gọn gàng' },
];

const buildRoomPayload = (form, selectedAmenities) => ({
  ...form,
  price: +form.price,
  area: form.area ? +form.area : null,
  available_slots: +form.available_slots,
  deposit_amount: form.deposit_amount ? +form.deposit_amount : null,
  electricity_price: form.electricity_price ? +form.electricity_price : null,
  water_price: form.water_price ? +form.water_price : null,
  internet_fee: form.internet_fee ? +form.internet_fee : null,
  parking_fee: form.parking_fee ? +form.parking_fee : null,
  service_fee: form.service_fee ? +form.service_fee : null,
  max_occupants: form.max_occupants ? +form.max_occupants : null,
  amenity_ids: selectedAmenities,
});

const EditRoom = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dialog = useDialog();
  const toast = useToast();

  const [form, setForm] = useState(null);
  const [roomImages, setRoomImages] = useState([]);
  const [newImages, setNewImages] = useState([]);
  const [amenities, setAmenities] = useState([]);
  const [selectedAmenities, setSelectedAmenities] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [errors, setErrors]     = useState({});
  const [apiError, setApiError] = useState('');
  const [success, setSuccess]   = useState('');

  useEffect(() => {
    const load = async () => {
      const [roomRes, amenRes] = await Promise.all([
        roomService.getRoomById(id),
        supabase.from('amenities').select('*').order('name'),
      ]);
      setForm({
        title: roomRes.title, price: roomRes.price, area: roomRes.area || '', available_slots: roomRes.available_slots ?? 1,
        address: roomRes.address, city: roomRes.city, description: roomRes.description || '',
        deposit_amount: roomRes.deposit_amount || '',
        electricity_price: roomRes.electricity_price || '',
        water_price: roomRes.water_price || '',
        internet_fee: roomRes.internet_fee || '',
        parking_fee: roomRes.parking_fee || '',
        service_fee: roomRes.service_fee || '',
        payment_cycle: roomRes.payment_cycle || 'monthly',
        is_owner_occupied: roomRes.is_owner_occupied || false,
        has_private_hours: roomRes.has_private_hours ?? true,
        allow_cooking: roomRes.allow_cooking ?? true,
        allow_pets: roomRes.allow_pets || false,
        allow_visitors: roomRes.allow_visitors ?? true,
        has_parking: roomRes.has_parking || false,
        max_occupants: roomRes.max_occupants || '',
        house_rules: roomRes.house_rules || '',
        roommate_gender_preference: roomRes.roommate_gender_preference || 'any',
        roommate_occupation_preference: roomRes.roommate_occupation_preference || 'any',
        roommate_schedule_preference: roomRes.roommate_schedule_preference || 'flexible',
        roommate_cleanliness_preference: roomRes.roommate_cleanliness_preference || 'normal',
        roommate_allow_smoker: roomRes.roommate_allow_smoker || false,
        roommate_allow_pets: roomRes.roommate_allow_pets ?? true,
        current_roommate_summary: roomRes.current_roommate_summary || '',
      });
      setSelectedAmenities(roomRes.room_amenities?.map(ra => ra.amenities?.id).filter(Boolean) || []);
      setRoomImages(roomRes.room_images || []);
      setAmenities(amenRes.data || []);
      setLoading(false);
    };
    load().catch(() => setLoading(false));
  }, [id]);

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(prev => ({ ...prev, [e.target.name]: value }));
    if (errors[e.target.name]) setErrors(prev => ({ ...prev, [e.target.name]: '' }));
  };

  const toggleAmenity = (aid) =>
    setSelectedAmenities(prev => prev.includes(aid) ? prev.filter(x => x !== aid) : [...prev, aid]);

  const handleNewImages = (e) => {
    setNewImages(Array.from(e.target.files || []).slice(0, 6));
  };

  const handleDeleteImage = async (imageId) => {
    const confirmed = await dialog.confirm({
      title: 'Xóa ảnh phòng',
      message: 'Bạn có chắc muốn xóa ảnh này khỏi phòng? Hành động này không thể hoàn tác.',
      confirmText: 'Xóa ảnh',
    });
    if (!confirmed) return;
    try {
      await roomService.deleteRoomImage(id, imageId);
      setRoomImages(prev => prev.filter(img => img.id !== imageId));
      toast.success('Đã xóa ảnh phòng.');
    } catch (err) {
      setApiError(err?.response?.data?.error || 'Xóa ảnh thất bại.');
      toast.error(err?.response?.data?.error || 'Xóa ảnh thất bại.');
    }
  };

  const handleSetPrimary = async (imageId) => {
    try {
      await roomService.setPrimaryImage(id, imageId);
      setRoomImages(prev => prev.map(img => ({ ...img, is_primary: img.id === imageId })));
    } catch (err) {
      setApiError(err?.response?.data?.error || 'Không thể đặt ảnh bìa.');
    }
  };

  const handleAI = async () => {
    if (!form.title || !form.price || !form.address) return;
    setAiLoading(true);
    try {
      const names = amenities.filter(a => selectedAmenities.includes(a.id)).map(a => a.name);
      const desc = await geminiService.generateDescription({ ...buildRoomPayload(form, selectedAmenities), amenities: names });
      setForm(prev => ({ ...prev, description: desc }));
    } catch { setApiError('AI gặp lỗi.'); }
    finally { setAiLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.title.trim())   errs.title   = 'Vui lòng nhập tiêu đề.';
    if (!form.price)          errs.price   = 'Vui lòng nhập giá.';
    if (!form.address.trim()) errs.address = 'Vui lòng nhập địa chỉ.';
    if (form.max_occupants && (!Number.isInteger(+form.max_occupants) || +form.max_occupants <= 0)) errs.max_occupants = 'Nhập số nguyên lớn hơn 0.';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true); setApiError('');
    try {
      await roomService.updateRoom(id, buildRoomPayload(form, selectedAmenities));
      if (newImages.length > 0) {
        await roomService.uploadRoomImages(id, newImages);
      }
      setSuccess('✅ Cập nhật thành công! Bài đang chờ duyệt lại.');
      setTimeout(() => navigate('/landlord/my-rooms'), 1500);
    } catch (err) {
      setApiError(err?.response?.data?.error || 'Cập nhật thất bại.');
    } finally { setSaving(false); }
  };

  if (loading) return <div className="loading-screen"><div className="spinner"/><p>Đang tải...</p></div>;

  return (
    <div className="post-room-page">
      <div className="container">
        <div className="pr-header animate-slideUp">
          <button className="pr-back" onClick={() => navigate('/landlord/my-rooms')}>← Quay lại</button>
          <h1>✏️ Chỉnh sửa bài đăng</h1>
          <p>Sau khi cập nhật, bài đăng sẽ chuyển về trạng thái chờ duyệt lại.</p>
        </div>

        {success  && <div className="alert alert-success">{success}</div>}
        {apiError && <div className="alert alert-error">⚠️ {apiError}</div>}

        <form onSubmit={handleSubmit} className="pr-form">
          <div className="pr-layout">
            <div className="pr-col">
              <div className="pr-section">
                <h2 className="pr-section-title">📋 Thông tin cơ bản</h2>
                <div className="form-group">
                  <label className="form-label">Tiêu đề *</label>
                  <input name="title" value={form.title} onChange={handleChange} className={`form-input ${errors.title?'error':''}`} />
                  {errors.title && <p className="form-error">{errors.title}</p>}
                </div>
                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Giá (VNĐ/tháng) *</label>
                    <input name="price" type="number" value={form.price} onChange={handleChange} className={`form-input ${errors.price?'error':''}`} />
                    {errors.price && <p className="form-error">{errors.price}</p>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Diện tích (m²)</label>
                    <input name="area" type="number" value={form.area} onChange={handleChange} className="form-input" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Số slot còn trống *</label>
                  <input name="available_slots" type="number" min="0" value={form.available_slots} onChange={handleChange} className="form-input" />
                </div>
                <div className="form-group">
                  <label className="form-label">Địa chỉ *</label>
                  <input name="address" value={form.address} onChange={handleChange} className={`form-input ${errors.address?'error':''}`} />
                  {errors.address && <p className="form-error">{errors.address}</p>}
                </div>
                <div className="form-group">
                  <label className="form-label">Tỉnh / Thành phố</label>
                  <select name="city" value={form.city} onChange={handleChange} className="form-input">
                    {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="pr-section">
                <div className="pr-section-title-row">
                  <h2 className="pr-section-title">📝 Mô tả</h2>
                  <button type="button" className="btn-ai" onClick={handleAI} disabled={aiLoading}>
                    {aiLoading ? 'Đang viết...' : '🤖 AI viết lại'}
                  </button>
                </div>
                <textarea name="description" value={form.description} onChange={handleChange}
                  className="form-input pr-textarea" rows={6} />
              </div>
              <div className="pr-section">
                <h2 className="pr-section-title">💰 Chi phí thực tế</h2>
                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Tiền cọc yêu cầu</label>
                    <input name="deposit_amount" type="number" min="0" value={form.deposit_amount} onChange={handleChange} className="form-input" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Chu kỳ thanh toán</label>
                    <select name="payment_cycle" value={form.payment_cycle} onChange={handleChange} className="form-input">
                      {PAYMENT_CYCLES.map(cycle => <option key={cycle.value} value={cycle.value}>{cycle.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Giá điện</label>
                    <input name="electricity_price" type="number" min="0" value={form.electricity_price} onChange={handleChange} className="form-input" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Giá nước</label>
                    <input name="water_price" type="number" min="0" value={form.water_price} onChange={handleChange} className="form-input" />
                  </div>
                </div>
                <div className="form-row-3">
                  <div className="form-group">
                    <label className="form-label">Wifi/tháng</label>
                    <input name="internet_fee" type="number" min="0" value={form.internet_fee} onChange={handleChange} className="form-input" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Gửi xe/tháng</label>
                    <input name="parking_fee" type="number" min="0" value={form.parking_fee} onChange={handleChange} className="form-input" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Dịch vụ/tháng</label>
                    <input name="service_fee" type="number" min="0" value={form.service_fee} onChange={handleChange} className="form-input" />
                  </div>
                </div>
              </div>
            </div>
            <div className="pr-col">
              <div className="pr-section">
                <h2 className="pr-section-title">📌 Nội quy phòng</h2>
                <div className="pr-rule-grid">
                  {[
                    ['is_owner_occupied', 'Có chung chủ'],
                    ['has_private_hours', 'Giờ giấc tự do'],
                    ['allow_cooking', 'Cho nấu ăn'],
                    ['allow_pets', 'Cho nuôi thú cưng'],
                    ['allow_visitors', 'Cho tiếp khách'],
                    ['has_parking', 'Có chỗ để xe'],
                  ].map(([name, label]) => (
                    <label key={name} className="pr-rule-toggle">
                      <input type="checkbox" name={name} checked={form[name]} onChange={handleChange} />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
                <div className="form-group">
                  <label className="form-label">Số người ở tối đa</label>
                  <input name="max_occupants" type="number" min="1" value={form.max_occupants} onChange={handleChange} className={`form-input ${errors.max_occupants?'error':''}`} />
                  {errors.max_occupants && <p className="form-error">{errors.max_occupants}</p>}
                </div>
                <div className="form-group">
                  <label className="form-label">Nội quy khác</label>
                  <textarea name="house_rules" value={form.house_rules} onChange={handleChange} className="form-input pr-small-textarea" rows={3} />
                </div>
              </div>
              <div className="pr-section">
                <h2 className="pr-section-title">🤝 Tiêu chí ở ghép</h2>
                <p className="form-hint">Thông tin này giúp người xin ở ghép biết trước phòng/người đang ở có phù hợp không.</p>
                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Kiểu phòng</label>
                    <select name="roommate_gender_preference" value={form.roommate_gender_preference} onChange={handleChange} className="form-input">
                      {ROOMMATE_GENDER_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Đối tượng phù hợp</label>
                    <select name="roommate_occupation_preference" value={form.roommate_occupation_preference} onChange={handleChange} className="form-input">
                      {ROOMMATE_OCCUPATION_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Giờ giấc mong muốn</label>
                    <select name="roommate_schedule_preference" value={form.roommate_schedule_preference} onChange={handleChange} className="form-input">
                      {ROOMMATE_SCHEDULE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Mức gọn gàng mong muốn</label>
                    <select name="roommate_cleanliness_preference" value={form.roommate_cleanliness_preference} onChange={handleChange} className="form-input">
                      {ROOMMATE_CLEANLINESS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="pr-rule-grid">
                  <label className="pr-rule-toggle">
                    <input type="checkbox" name="roommate_allow_smoker" checked={form.roommate_allow_smoker} onChange={handleChange} />
                    <span>Chấp nhận người hút thuốc</span>
                  </label>
                  <label className="pr-rule-toggle">
                    <input type="checkbox" name="roommate_allow_pets" checked={form.roommate_allow_pets} onChange={handleChange} />
                    <span>Chấp nhận người có thú cưng</span>
                  </label>
                </div>
                <div className="form-group">
                  <label className="form-label">Người đang ở / tiêu chí thêm</label>
                  <textarea name="current_roommate_summary" value={form.current_roommate_summary} onChange={handleChange} className="form-input pr-small-textarea" rows={3} placeholder="VD: hiện có 2 nữ sinh viên, không hút thuốc, ưu tiên người yên tĩnh..." />
                </div>
              </div>
              <div className="pr-section">
                <h2 className="pr-section-title">⚡ Tiện ích</h2>
                <div className="pr-amenities">
                  {amenities.map(a => (
                    <button key={a.id} type="button"
                      className={`pr-amenity-btn ${selectedAmenities.includes(a.id)?'selected':''}`}
                      onClick={() => toggleAmenity(a.id)}>
                      {selectedAmenities.includes(a.id)?'✅':'⬜'} {a.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="pr-section">
                <h2 className="pr-section-title">Ảnh phòng</h2>
                {roomImages.length > 0 && (
                  <div className="edit-images">
                    {roomImages.map(img => (
                      <div key={img.id} className="edit-image">
                        <img src={img.image_url} alt="" />
                        {img.is_primary && <span>Ảnh bìa</span>}
                        <div className="edit-image__actions">
                          {!img.is_primary && (
                            <button type="button" className="btn btn-sm btn-secondary" onClick={() => handleSetPrimary(img.id)}>Đặt bìa</button>
                          )}
                          <button type="button" className="btn btn-sm btn-danger" onClick={() => handleDeleteImage(img.id)}>Xóa</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {roomImages.length === 0 && <p className="pr-empty-hint">Phòng chưa có ảnh.</p>}
                <input type="file" multiple accept="image/*" onChange={handleNewImages} className="form-input" />
                {newImages.length > 0 && <p className="form-hint">Sẽ thêm {newImages.length} ảnh khi lưu.</p>}
              </div>
              <div className="pr-section pr-submit-section">
                <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={saving}>
                  {saving ? 'Đang lưu...' : '💾 Lưu thay đổi'}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
      <style>{`
        .post-room-page{padding:32px 0 80px}
        .pr-header{margin-bottom:32px}
        .pr-back{background:none;border:none;color:var(--text-muted);font-size:14px;cursor:pointer;padding:0;margin-bottom:12px;transition:var(--transition)}
        .pr-back:hover{color:var(--primary-light)}
        .pr-header h1{font-size:28px;font-weight:800;color:var(--text-primary);margin-bottom:8px}
        .pr-header p{color:var(--text-secondary);font-size:15px}
        .alert{padding:14px 18px;border-radius:var(--radius-md);font-size:14px;margin-bottom:20px}
        .alert-success{background:var(--success-light);color:var(--success);border:1px solid #bbf7d0}
        .alert-error{background:var(--danger-light);color:var(--danger);border:1px solid #fecaca}
        .pr-form{width:100%}
        .pr-layout{display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start}
        @media(max-width:900px){.pr-layout{grid-template-columns:1fr}}
        .pr-col{display:flex;flex-direction:column;gap:20px}
        .pr-section{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg);padding:24px;display:flex;flex-direction:column;gap:16px}
        .pr-section-title{font-size:16px;font-weight:700;color:var(--text-primary)}
        .pr-section-title-row{display:flex;align-items:center;justify-content:space-between}
        .btn-ai{padding:8px 14px;background:linear-gradient(135deg,var(--primary),var(--info));color:#fff;border-radius:var(--radius-md);font-size:13px;font-weight:600;border:none;cursor:pointer;transition:var(--transition)}
        .btn-ai:disabled{opacity:.5;cursor:not-allowed}
        .pr-textarea{resize:vertical;min-height:140px}
        .pr-small-textarea{resize:vertical;min-height:88px}
        .form-row-3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
        @media(max-width:640px){.form-row-3{grid-template-columns:1fr}}
        .pr-rule-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
        .pr-rule-toggle{display:flex;align-items:center;gap:8px;padding:10px 12px;border:1px solid var(--border);border-radius:var(--radius-md);background:var(--bg-surface);font-size:13px;color:var(--text-secondary);cursor:pointer}
        .pr-rule-toggle input{accent-color:var(--primary)}
        .pr-amenities{display:flex;flex-wrap:wrap;gap:8px}
        .pr-amenity-btn{padding:8px 12px;background:var(--bg-surface);border:1.5px solid var(--border);border-radius:var(--radius-md);color:var(--text-secondary);font-size:13px;cursor:pointer;transition:var(--transition)}
        .pr-amenity-btn:hover{border-color:var(--primary);color:var(--text-primary)}
        .pr-amenity-btn.selected{background:var(--primary-50);border-color:var(--primary);color:var(--primary-dark)}
        .edit-images{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
        .edit-image{position:relative;border:1px solid var(--border);border-radius:var(--radius-md);overflow:hidden;background:var(--bg-surface)}
        .edit-image img{width:100%;aspect-ratio:4/3;object-fit:cover;display:block}
        .edit-image span{position:absolute;top:6px;left:6px;background:var(--primary);color:#fff;font-size:11px;font-weight:700;padding:3px 8px;border-radius:var(--radius-full)}
        .edit-image__actions{display:flex;gap:6px;padding:8px;flex-wrap:wrap}
        .pr-submit-section{gap:12px}
        .form-row-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      `}</style>
    </div>
  );
};

export default EditRoom;
