import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { roomService } from '../../services/roomService';
import { geminiService } from '../../services/geminiService';
import { supabase } from '../../services/supabaseClient';

const CITIES = ['Hà Nội', 'Hồ Chí Minh', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ', 'Huế', 'Nha Trang', 'Biên Hòa', 'Vũng Tàu'];

const PostRoom = () => {
  useAuth(); // ensure authenticated
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: '', price: '', area: '', address: '', city: 'Hà Nội', description: '',
    available_slots: 1,
  });
  const [selectedAmenities, setSelectedAmenities] = useState([]);
  const [amenities, setAmenities]   = useState([]);
  const [images, setImages]         = useState([]);       // File[]
  const [previews, setPreviews]     = useState([]);       // URL[]
  const [errors, setErrors]         = useState({});
  const [loading, setLoading]       = useState(false);
  const [aiLoading, setAiLoading]   = useState(false);
  const [success, setSuccess]       = useState('');
  const [apiError, setApiError]     = useState('');

  // Load amenities từ Supabase
  useEffect(() => {
    supabase.from('amenities').select('*').order('name').then(({ data }) => {
      if (data) setAmenities(data);
    });
  }, []);

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
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
        title: form.title, price: form.price, area: form.area,
        address: form.address, city: form.city, amenities: amenityNames,
      });
      setForm(prev => ({ ...prev, description: desc }));
    } catch {
      setApiError('AI gặp lỗi. Kiểm tra GEMINI_API_KEY trong backend/.env');
    } finally {
      setAiLoading(false);
    }
  };

  const validate = () => {
    const e = {};
    if (!form.title.trim())   e.title   = 'Vui lòng nhập tiêu đề.';
    if (!form.price)          e.price   = 'Vui lòng nhập giá thuê.';
    else if (isNaN(form.price) || +form.price <= 0) e.price = 'Giá phải là số dương.';
    if (!form.address.trim()) e.address = 'Vui lòng nhập địa chỉ.';
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
        title: form.title, price: +form.price, area: form.area ? +form.area : null,
        address: form.address, city: form.city, description: form.description,
        available_slots: form.available_slots ? +form.available_slots : 1,
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

              {/* Mô tả + AI */}
              <div className="pr-section animate-slideUp" style={{ animationDelay: '0.1s' }}>
                <div className="pr-section-title-row">
                  <h2 className="pr-section-title">📝 Mô tả phòng</h2>
                  <button type="button" id="btn-ai-generate" className="btn btn-ai" onClick={handleAI} disabled={aiLoading}>
                    {aiLoading
                      ? <><span className="spinner" style={{width:14,height:14,borderWidth:2}}/> Đang viết...</>
                      : '🤖 AI viết mô tả'}
                  </button>
                </div>
                <textarea name="description" value={form.description} onChange={handleChange}
                  className="form-input pr-textarea"
                  placeholder="Nhập mô tả phòng, hoặc nhấn '🤖 AI viết mô tả' để AI tự động tạo nội dung." rows={6} />
                <p className="form-hint">💡 Tip: Điền Tiêu đề, Giá, Địa chỉ trước rồi nhấn AI để có mô tả chuẩn nhất.</p>
              </div>
            </div>

            {/* ── RIGHT: Tiện ích + Ảnh ── */}
            <div className="pr-col">
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
  .btn-ai { padding:8px 14px;background:linear-gradient(135deg,var(--primary),var(--info));color:#fff;border-radius:var(--radius-md);font-size:13px;font-weight:600;border:none;cursor:pointer;display:flex;align-items:center;gap:6px;transition:var(--transition); }
  .btn-ai:hover { opacity:.9;transform:translateY(-1px); }
  .btn-ai:disabled { opacity:.5;cursor:not-allowed;transform:none; }
  .pr-textarea { resize:vertical;min-height:140px; }
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
