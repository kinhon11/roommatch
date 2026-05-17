import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { roomService } from '../../services/roomService';
import { supabase } from '../../services/supabaseClient';
import { geminiService } from '../../services/geminiService';

const CITIES = ['Hà Nội', 'Hồ Chí Minh', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ', 'Huế', 'Nha Trang', 'Biên Hòa', 'Vũng Tàu'];

const EditRoom = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState(null);
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
      });
      setSelectedAmenities(roomRes.room_amenities?.map(ra => ra.amenities?.id).filter(Boolean) || []);
      setAmenities(amenRes.data || []);
      setLoading(false);
    };
    load().catch(() => setLoading(false));
  }, [id]);

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    if (errors[e.target.name]) setErrors(prev => ({ ...prev, [e.target.name]: '' }));
  };

  const toggleAmenity = (aid) =>
    setSelectedAmenities(prev => prev.includes(aid) ? prev.filter(x => x !== aid) : [...prev, aid]);

  const handleAI = async () => {
    if (!form.title || !form.price || !form.address) return;
    setAiLoading(true);
    try {
      const names = amenities.filter(a => selectedAmenities.includes(a.id)).map(a => a.name);
      const desc = await geminiService.generateDescription({ ...form, amenities: names });
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
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true); setApiError('');
    try {
      await roomService.updateRoom(id, { ...form, price: +form.price, area: form.area ? +form.area : null, available_slots: +form.available_slots, amenity_ids: selectedAmenities });
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
            </div>
            <div className="pr-col">
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
        .pr-amenities{display:flex;flex-wrap:wrap;gap:8px}
        .pr-amenity-btn{padding:8px 12px;background:var(--bg-surface);border:1.5px solid var(--border);border-radius:var(--radius-md);color:var(--text-secondary);font-size:13px;cursor:pointer;transition:var(--transition)}
        .pr-amenity-btn:hover{border-color:var(--primary);color:var(--text-primary)}
        .pr-amenity-btn.selected{background:var(--primary-50);border-color:var(--primary);color:var(--primary-dark)}
        .pr-submit-section{gap:12px}
        .form-row-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      `}</style>
    </div>
  );
};

export default EditRoom;
