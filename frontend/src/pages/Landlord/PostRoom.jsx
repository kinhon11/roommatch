import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { roomService } from '../../services/roomService';
import { geminiService } from '../../services/geminiService';
import { supabase } from '../../services/supabaseClient';

const CITIES = ['Hà Nội', 'Hồ Chí Minh', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ', 'Huế', 'Nha Trang', 'Biên Hòa', 'Vũng Tàu'];
const PAYMENT_CYCLES = [
  { value: 'monthly', label: 'Hàng tháng' },
  { value: 'quarterly', label: 'Theo quý' },
  { value: 'negotiable', label: 'Thỏa thuận' },
];

const MONEY_FIELDS = ['deposit_amount', 'electricity_price', 'water_price', 'internet_fee', 'parking_fee', 'service_fee'];
const getDefaultDepositAmount = (form) => form.deposit_amount || form.price;
const buildRoomPayload = (form) => ({
  title: form.title,
  price: +form.price,
  area: form.area ? +form.area : null,
  address: form.address,
  city: form.city,
  description: form.description,
  available_slots: form.available_slots ? +form.available_slots : 1,
  deposit_amount: getDefaultDepositAmount(form) ? +getDefaultDepositAmount(form) : null,
  electricity_price: form.electricity_price ? +form.electricity_price : null,
  water_price: form.water_price ? +form.water_price : null,
  internet_fee: form.internet_fee ? +form.internet_fee : null,
  parking_fee: form.parking_fee ? +form.parking_fee : null,
  service_fee: form.service_fee ? +form.service_fee : null,
  payment_cycle: form.payment_cycle,
  is_owner_occupied: form.is_owner_occupied,
  has_private_hours: form.has_private_hours,
  allow_cooking: form.allow_cooking,
  allow_pets: form.allow_pets,
  allow_visitors: form.allow_visitors,
  has_parking: form.has_parking,
  max_occupants: form.max_occupants ? +form.max_occupants : null,
  house_rules: form.house_rules,
});

const PostRoom = () => {
  useAuth(); // ensure authenticated
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: '', price: '', area: '', address: '', city: 'Hà Nội', description: '',
    available_slots: 1,
    deposit_amount: '', electricity_price: '', water_price: '', internet_fee: '',
    parking_fee: '', service_fee: '', payment_cycle: 'monthly',
    is_owner_occupied: false, has_private_hours: true, allow_cooking: true,
    allow_pets: false, allow_visitors: true, has_parking: false,
    max_occupants: '', house_rules: '',
  });
  const [selectedAmenities, setSelectedAmenities] = useState([]);
  const [amenities, setAmenities]   = useState([]);
  const [images, setImages]         = useState([]);       // File[]
  const [previews, setPreviews]     = useState([]);       // URL[]
  const [errors, setErrors]         = useState({});
  const [loading, setLoading]       = useState(false);
  const [aiLoading, setAiLoading]   = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [listingAnalysis, setListingAnalysis] = useState(null);
  const [success, setSuccess]       = useState('');
  const [apiError, setApiError]     = useState('');

  // Load amenities từ Supabase
  useEffect(() => {
    supabase.from('amenities').select('*').order('name').then(({ data }) => {
      if (data) setAmenities(data);
    });
  }, []);

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(prev => {
      const next = { ...prev, [e.target.name]: value };
      if (e.target.name === 'price' && (prev.deposit_amount === '' || prev.deposit_amount === prev.price)) {
        next.deposit_amount = value;
      }
      return next;
    });
    if (errors[e.target.name]) setErrors(prev => ({ ...prev, [e.target.name]: '' }));
    setApiError('');
  };

  const toggleAmenity = (id) => {
    setSelectedAmenities(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleImages = (e) => {
    const files = Array.from(e.target.files).slice(0, 6); // max 6 ảnh
    setImages(files);
    setPreviews(files.map(f => URL.createObjectURL(f)));
  };

  const removeImage = (idx) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
    setPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  // AI tự động sinh mô tả
  const handleAI = async () => {
    if (!form.title || !form.price || !form.address) {
      setErrors({ title: !form.title ? 'Cần nhập tiêu đề trước.' : '', price: !form.price ? 'Cần nhập giá trước.' : '', address: !form.address ? 'Cần nhập địa chỉ trước.' : '' });
      return;
    }
    setAiLoading(true);
    try {
      const amenityNames = amenities.filter(a => selectedAmenities.includes(a.id)).map(a => a.name);
      const desc = await geminiService.generateDescription({
        ...buildRoomPayload(form),
        amenities: amenityNames,
      });
      setForm(prev => ({ ...prev, description: desc }));
    } catch {
      setApiError('AI gặp lỗi. Kiểm tra GEMINI_API_KEY hoặc MINIMAX_API_KEY trong backend/.env');
    } finally {
      setAiLoading(false);
    }
  };

  const handleAnalyzeListing = async () => {
    if (!form.title || !form.price || !form.address) {
      setErrors({ title: !form.title ? 'Cần nhập tiêu đề trước.' : '', price: !form.price ? 'Cần nhập giá trước.' : '', address: !form.address ? 'Cần nhập địa chỉ trước.' : '' });
      return;
    }
    setAnalysisLoading(true);
    try {
      const amenityNames = amenities.filter(a => selectedAmenities.includes(a.id)).map(a => a.name);
      const analysis = await geminiService.analyzeListing({
        ...buildRoomPayload(form),
        amenities: amenityNames,
        image_count: images.length,
      });
      setListingAnalysis(analysis);
      setApiError('');
    } catch {
      setApiError('AI kiểm tra tin đăng gặp lỗi. Kiểm tra GEMINI_API_KEY hoặc MINIMAX_API_KEY trong backend/.env');
    } finally {
      setAnalysisLoading(false);
    }
  };

  const validate = () => {
    const e = {};
    if (!form.title.trim())   e.title   = 'Vui lòng nhập tiêu đề.';
    if (!form.price)          e.price   = 'Vui lòng nhập giá thuê.';
    else if (isNaN(form.price) || +form.price <= 0) e.price = 'Giá phải là số dương.';
    if (!form.address.trim()) e.address = 'Vui lòng nhập địa chỉ.';
    MONEY_FIELDS.forEach((field) => {
      if (form[field] !== '' && (+form[field] < 0 || Number.isNaN(+form[field]))) e[field] = 'Không được âm.';
    });
    if (form.max_occupants !== '' && (!Number.isInteger(+form.max_occupants) || +form.max_occupants <= 0)) {
      e.max_occupants = 'Nhập số nguyên lớn hơn 0.';
    }
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true); setApiError('');
    try {
      // 1. Đăng tin (status: pending)
      const res = await roomService.createRoom({
        ...buildRoomPayload(form),
        amenity_ids: selectedAmenities,
      });

      const roomId = res.room.id;

      // 2. Upload ảnh nếu có
      if (images.length > 0) {
        await roomService.uploadRoomImages(roomId, images);
      }

      setSuccess('🎉 Đăng tin thành công! Bài đang chờ Admin duyệt.');
      setTimeout(() => navigate('/landlord/my-rooms'), 2000);
    } catch (err) {
      setApiError(err?.response?.data?.error || 'Đăng tin thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="post-room-page">
      <div className="container">
        {/* Header */}
        <div className="pr-header animate-slideUp">
          <button className="pr-back" onClick={() => navigate('/landlord/dashboard')}>← Quay lại</button>
          <h1>📝 Đăng tin phòng trọ</h1>
          <p>Điền thông tin chi tiết. Bài đăng sẽ được Admin duyệt trước khi hiển thị.</p>
        </div>

        {success && <div className="alert alert-success animate-slideUp">{success}</div>}
        {apiError && <div className="alert alert-error animate-slideUp">⚠️ {apiError}</div>}

        <form onSubmit={handleSubmit} className="pr-form">
          <div className="pr-layout">
            {/* ── LEFT: Thông tin cơ bản ── */}
            <div className="pr-col">
              <div className="pr-section animate-slideUp">
                <h2 className="pr-section-title">📋 Thông tin cơ bản</h2>

                <div className="form-group">
                  <label className="form-label">Tiêu đề bài đăng *</label>
                  <input name="title" value={form.title} onChange={handleChange}
                    className={`form-input ${errors.title ? 'error' : ''}`}
                    placeholder="VD: Phòng trọ cao cấp full nội thất, gần ĐH Bách Khoa" />
                  {errors.title && <p className="form-error">{errors.title}</p>}
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Giá thuê (VNĐ/tháng) *</label>
                    <input name="price" type="number" value={form.price} onChange={handleChange}
                      className={`form-input ${errors.price ? 'error' : ''}`}
                      placeholder="VD: 3500000" min="0" />
                    {errors.price && <p className="form-error">{errors.price}</p>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Diện tích (m²)</label>
                    <input name="area" type="number" value={form.area} onChange={handleChange}
                      className="form-input" placeholder="VD: 25" min="0" />
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Số chỗ ở ghép tối đa 🏘️</label>
                    <input name="available_slots" type="number" value={form.available_slots} onChange={handleChange}
                      className="form-input" placeholder="Số người có thể ở ghép" min="0" max="20" />
                    <p className="form-hint" style={{marginTop:4}}>0 = không cho ở ghép</p>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Địa chỉ *</label>
                  <input name="address" value={form.address} onChange={handleChange}
                    className={`form-input ${errors.address ? 'error' : ''}`}
                    placeholder="Số nhà, tên đường, phường/xã, quận/huyện" />
                  {errors.address && <p className="form-error">{errors.address}</p>}
                </div>

                <div className="form-group">
                  <label className="form-label">Tỉnh / Thành phố</label>
                  <select name="city" value={form.city} onChange={handleChange} className="form-input">
                    {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="pr-section animate-slideUp" style={{ animationDelay: '0.08s' }}>
                <h2 className="pr-section-title">💰 Chi phí thực tế</h2>
                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Tiền cọc yêu cầu</label>
                    <input name="deposit_amount" type="number" value={form.deposit_amount} onChange={handleChange} className={`form-input ${errors.deposit_amount ? 'error' : ''}`} placeholder="Mặc định bằng 1 tháng tiền thuê" min="0" />
                    <p className="form-hint">Thực tế thường cọc 1 tháng tiền thuê; bạn vẫn có thể sửa theo từng phòng.</p>
                    {errors.deposit_amount && <p className="form-error">{errors.deposit_amount}</p>}
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
                    <input name="electricity_price" type="number" value={form.electricity_price} onChange={handleChange} className={`form-input ${errors.electricity_price ? 'error' : ''}`} placeholder="VD: 4000 / kWh" min="0" />
                    {errors.electricity_price && <p className="form-error">{errors.electricity_price}</p>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Giá nước</label>
                    <input name="water_price" type="number" value={form.water_price} onChange={handleChange} className={`form-input ${errors.water_price ? 'error' : ''}`} placeholder="VD: 100000 / người" min="0" />
                    {errors.water_price && <p className="form-error">{errors.water_price}</p>}
                  </div>
                </div>
                <div className="form-row-3">
                  <div className="form-group">
                    <label className="form-label">Wifi/tháng</label>
                    <input name="internet_fee" type="number" value={form.internet_fee} onChange={handleChange} className={`form-input ${errors.internet_fee ? 'error' : ''}`} placeholder="0" min="0" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Gửi xe/tháng</label>
                    <input name="parking_fee" type="number" value={form.parking_fee} onChange={handleChange} className={`form-input ${errors.parking_fee ? 'error' : ''}`} placeholder="0" min="0" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Dịch vụ/tháng</label>
                    <input name="service_fee" type="number" value={form.service_fee} onChange={handleChange} className={`form-input ${errors.service_fee ? 'error' : ''}`} placeholder="0" min="0" />
                  </div>
                </div>
              </div>

              {/* Mô tả + AI */}
              <div className="pr-section animate-slideUp" style={{ animationDelay: '0.1s' }}>
                <div className="pr-section-title-row">
                  <h2 className="pr-section-title">📝 Mô tả phòng</h2>
                  <div className="pr-ai-actions">
                    <button type="button" id="btn-ai-analyze" className="btn btn-ai btn-ai-secondary" onClick={handleAnalyzeListing} disabled={analysisLoading}>
                      {analysisLoading
                        ? <><span className="spinner" style={{width:14,height:14,borderWidth:2}}/> Đang kiểm tra...</>
                        : '🔎 AI kiểm tra tin'}
                    </button>
                    <button type="button" id="btn-ai-generate" className="btn btn-ai" onClick={handleAI} disabled={aiLoading}>
                      {aiLoading
                        ? <><span className="spinner" style={{width:14,height:14,borderWidth:2}}/> Đang viết...</>
                        : '🤖 AI viết mô tả'}
                    </button>
                  </div>
                </div>
                <textarea name="description" value={form.description} onChange={handleChange}
                  className="form-input pr-textarea"
                  placeholder="Nhập mô tả phòng, hoặc nhấn '🤖 AI viết mô tả' để AI tự động tạo nội dung." rows={6} />
                <p className="form-hint">💡 Tip: Điền Tiêu đề, Giá, Địa chỉ trước rồi nhấn AI để có mô tả chuẩn nhất.</p>

                {listingAnalysis && (
                  <div className="ai-analysis-panel">
                    <div className="ai-analysis-panel__head">
                      <div>
                        <p className="ai-analysis-panel__label">AI kiểm tra tin đăng</p>
                        <h3>{listingAnalysis.status === 'ready' ? 'Tin đã khá sẵn sàng' : 'Tin còn vài chỗ cần chỉnh'}</h3>
                      </div>
                      <div className={`ai-score ai-score--${listingAnalysis.risk_level || 'medium'}`}>
                        {typeof listingAnalysis.score === 'number' ? `${listingAnalysis.score}/100` : 'N/A'}
                      </div>
                    </div>

                    {listingAnalysis.summary && <p className="ai-analysis-panel__summary">{listingAnalysis.summary}</p>}

                    <div className="ai-analysis-grid">
                      <div>
                        <h4>Điểm mạnh</h4>
                        <ul>
                          {(listingAnalysis.strengths || []).length > 0
                            ? listingAnalysis.strengths.map((item, index) => <li key={index}>{item}</li>)
                            : <li>Chưa có dữ liệu đánh giá.</li>}
                        </ul>
                      </div>
                      <div>
                        <h4>Cần sửa</h4>
                        <ul>
                          {(listingAnalysis.issues || []).length > 0
                            ? listingAnalysis.issues.map((item, index) => <li key={index}>{item}</li>)
                            : <li>Chưa phát hiện vấn đề rõ ràng.</li>}
                        </ul>
                      </div>
                    </div>

                    {(listingAnalysis.suggestions || []).length > 0 && (
                      <div className="ai-analysis-panel__list">
                        <h4>Gợi ý hành động</h4>
                        <ul>
                          {listingAnalysis.suggestions.map((item, index) => <li key={index}>{item}</li>)}
                        </ul>
                      </div>
                    )}

                    {(listingAnalysis.missing_fields || []).length > 0 && (
                      <div className="ai-analysis-panel__chips">
                        {listingAnalysis.missing_fields.map((item, index) => (
                          <span key={index} className="ai-analysis-chip">{item}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ── RIGHT: Tiện ích + Ảnh ── */}
            <div className="pr-col">
              <div className="pr-section animate-slideUp" style={{ animationDelay: '0.12s' }}>
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
                  <input name="max_occupants" type="number" value={form.max_occupants} onChange={handleChange} className={`form-input ${errors.max_occupants ? 'error' : ''}`} placeholder="VD: 2" min="1" />
                  {errors.max_occupants && <p className="form-error">{errors.max_occupants}</p>}
                </div>
                <div className="form-group">
                  <label className="form-label">Nội quy khác</label>
                  <textarea name="house_rules" value={form.house_rules} onChange={handleChange} className="form-input pr-small-textarea" rows={3} placeholder="VD: giữ yên lặng sau 22h, không hút thuốc trong phòng..." />
                </div>
              </div>

              {/* Tiện ích */}
              <div className="pr-section animate-slideUp" style={{ animationDelay: '0.15s' }}>
                <h2 className="pr-section-title">⚡ Tiện ích</h2>
                {amenities.length === 0
                  ? <p className="pr-empty-hint">Đang tải tiện ích...</p>
                  : (
                    <div className="pr-amenities">
                      {amenities.map(a => (
                        <button key={a.id} type="button"
                          className={`pr-amenity-btn ${selectedAmenities.includes(a.id) ? 'selected' : ''}`}
                          onClick={() => toggleAmenity(a.id)}>
                          {selectedAmenities.includes(a.id) ? '✅' : '⬜'} {a.name}
                        </button>
                      ))}
                    </div>
                  )}
              </div>

              {/* Upload ảnh */}
              <div className="pr-section animate-slideUp" style={{ animationDelay: '0.2s' }}>
                <h2 className="pr-section-title">📸 Ảnh phòng (tối đa 6)</h2>
                <label className="pr-upload-area" htmlFor="room-images-input">
                  <span className="pr-upload-icon">📁</span>
                  <p>Kéo thả hoặc <strong>nhấn để chọn ảnh</strong></p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>JPG, PNG, WEBP – Tối đa 6 ảnh</p>
                  <input id="room-images-input" type="file" multiple accept="image/*"
                    onChange={handleImages} style={{ display: 'none' }} />
                </label>

                {previews.length > 0 && (
                  <div className="pr-previews">
                    {previews.map((url, i) => (
                      <div key={i} className="pr-preview-item">
                        <img src={url} alt={`preview-${i}`} />
                        {i === 0 && <span className="pr-primary-badge">Ảnh bìa</span>}
                        <button type="button" className="pr-remove-img" onClick={() => removeImage(i)}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit */}
              <div className="pr-section pr-submit-section">
                <div className="pr-submit-info">
                  <p>🔔 Bài đăng sẽ ở trạng thái <strong className="badge badge-pending">Chờ duyệt</strong> cho đến khi Admin phê duyệt.</p>
                </div>
                <button type="submit" id="btn-post-room-submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
                  {loading
                    ? <><span className="spinner" style={{width:18,height:18,borderWidth:2}}/> Đang đăng tin...</>
                    : '🚀 Đăng tin ngay'}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>

      <style>{postRoomStyles}</style>
    </div>
  );
};

const postRoomStyles = `
  .post-room-page { padding: 32px 0 80px; }
  .pr-header { margin-bottom: 32px; }
  .pr-back { background:none;border:none;color:var(--text-muted);font-size:14px;cursor:pointer;padding:0;margin-bottom:12px;transition:var(--transition); }
  .pr-back:hover { color:var(--primary-light); }
  .pr-header h1 { font-size:28px;font-weight:800;color:var(--text-primary);margin-bottom:8px; }
  .pr-header p  { color:var(--text-secondary);font-size:15px; }
  .alert { padding:14px 18px;border-radius:var(--radius-md);font-size:14px;margin-bottom:20px; }
  .alert-success { background:var(--success-light);color:var(--success);border:1px solid #bbf7d0; }
  .alert-error   { background:var(--danger-light);color:var(--danger);border:1px solid #fecaca; }
  .pr-form { width:100%; }
  .pr-layout { display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start; }
  @media(max-width:900px){.pr-layout{grid-template-columns:1fr;}}
  .pr-col { display:flex;flex-direction:column;gap:20px; }
  .pr-section { background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg);padding:24px;display:flex;flex-direction:column;gap:16px; }
  .pr-section-title { font-size:16px;font-weight:700;color:var(--text-primary); }
  .pr-section-title-row { display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px; }
  .pr-ai-actions { display:flex;flex-wrap:wrap;gap:8px; }
  .btn-ai { padding:8px 14px;background:linear-gradient(135deg,var(--primary),var(--info));color:#fff;border-radius:var(--radius-md);font-size:13px;font-weight:600;border:none;cursor:pointer;display:flex;align-items:center;gap:6px;transition:var(--transition); }
  .btn-ai:hover { opacity:.9;transform:translateY(-1px); }
  .btn-ai:disabled { opacity:.5;cursor:not-allowed;transform:none; }
  .btn-ai-secondary { background:var(--primary-50);color:var(--primary-dark);border:1px solid var(--primary-100); }
  .pr-textarea { resize:vertical;min-height:140px; }
  .pr-small-textarea { resize:vertical;min-height:88px; }
  .form-row-3 { display:grid;grid-template-columns:repeat(3,1fr);gap:12px; }
  @media(max-width:640px){ .form-row-3{grid-template-columns:1fr;} }
  .pr-rule-grid { display:grid;grid-template-columns:1fr 1fr;gap:10px; }
  .pr-rule-toggle { display:flex;align-items:center;gap:8px;padding:10px 12px;border:1px solid var(--border);border-radius:var(--radius-md);background:var(--bg-surface);font-size:13px;color:var(--text-secondary);cursor:pointer; }
  .pr-rule-toggle input { accent-color:var(--primary); }
  .ai-analysis-panel { margin-top:4px;padding:18px;border-radius:var(--radius-lg);background:var(--bg-surface);border:1px solid var(--border);display:flex;flex-direction:column;gap:14px; }
  .ai-analysis-panel__head { display:flex;align-items:flex-start;justify-content:space-between;gap:12px; }
  .ai-analysis-panel__label { font-size:12px;font-weight:700;color:var(--primary-dark);text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px; }
  .ai-analysis-panel__head h3 { font-size:16px;font-weight:700;color:var(--text-primary); }
  .ai-score { min-width:72px;padding:8px 12px;border-radius:var(--radius-full);font-size:13px;font-weight:800;text-align:center; }
  .ai-score--low { background:var(--primary-50);color:var(--primary-dark); }
  .ai-score--medium { background:#fef3c7;color:#92400e; }
  .ai-score--high { background:#fee2e2;color:var(--danger); }
  .ai-analysis-panel__summary { color:var(--text-secondary);line-height:1.6;font-size:14px; }
  .ai-analysis-grid { display:grid;grid-template-columns:1fr 1fr;gap:12px; }
  @media(max-width:640px){ .ai-analysis-grid{grid-template-columns:1fr;} }
  .ai-analysis-grid h4,
  .ai-analysis-panel__list h4 { font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:8px; }
  .ai-analysis-grid ul,
  .ai-analysis-panel__list ul { margin:0;padding-left:18px;color:var(--text-secondary);font-size:13px;line-height:1.6;display:flex;flex-direction:column;gap:6px; }
  .ai-analysis-panel__chips { display:flex;flex-wrap:wrap;gap:8px; }
  .ai-analysis-chip { padding:6px 10px;border-radius:var(--radius-full);background:var(--bg-hover);border:1px solid var(--border);font-size:12px;color:var(--text-secondary); }
  .pr-amenities { display:flex;flex-wrap:wrap;gap:8px; }
  .pr-amenity-btn { padding:8px 12px;background:var(--bg-surface);border:1.5px solid var(--border);border-radius:var(--radius-md);color:var(--text-secondary);font-size:13px;cursor:pointer;transition:var(--transition); }
  .pr-amenity-btn:hover   { border-color:var(--primary);color:var(--text-primary); }
  .pr-amenity-btn.selected{ background:var(--primary-50);border-color:var(--primary);color:var(--primary-dark); }
  .pr-upload-area { display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:32px;border:2px dashed var(--border);border-radius:var(--radius-lg);cursor:pointer;text-align:center;transition:var(--transition);color:var(--text-secondary); }
  .pr-upload-area:hover { border-color:var(--primary);background:var(--primary-50); }
  .pr-upload-icon { font-size:36px; }
  .pr-previews { display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px; }
  .pr-preview-item { position:relative;border-radius:var(--radius-md);overflow:hidden;aspect-ratio:4/3; }
  .pr-preview-item img { width:100%;height:100%;object-fit:cover; }
  .pr-primary-badge { position:absolute;bottom:6px;left:6px;background:var(--primary);color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:var(--radius-full); }
  .pr-remove-img { position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.6);color:#fff;border:none;border-radius:50%;width:22px;height:22px;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center; }
  .pr-submit-section { gap:12px; }
  .pr-submit-info { font-size:13px;color:var(--text-secondary);line-height:1.6; }
  .pr-empty-hint { color:var(--text-muted);font-size:14px; }
  .form-row-2 { display:grid;grid-template-columns:1fr 1fr;gap:12px; }
`;

export default PostRoom;
