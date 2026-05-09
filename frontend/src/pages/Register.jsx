import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';

const Register = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: '', email: '', password: '', confirmPassword: '', role: 'tenant',
  });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.full_name || !form.email || !form.password) {
      setError('Vui lòng điền đầy đủ thông tin.');
      return;
    }
    if (form.password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    setLoading(true);
    try {
      await authService.register({
        full_name: form.full_name,
        email: form.email,
        password: form.password,
        role: form.role,
      });
      setSuccess('🎉 Đăng ký thành công! Chuyển hướng đến trang đăng nhập...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Đăng ký thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-page__bg" />

      <div className="auth-container animate-slideUp">
        {/* Left — Brand panel */}
        <div className="auth-brand auth-brand--register">
          <div className="auth-brand__content">
            <div className="auth-brand__logo">
              <span className="auth-brand__mark">R</span>
              <span className="auth-brand__name">RoommieMatch</span>
            </div>
            <h2 className="auth-brand__title">
              Bắt đầu hành trình<br/>tìm phòng trọ
            </h2>
            <p className="auth-brand__desc">
              Tạo tài khoản miễn phí để tìm phòng trọ, đăng tin cho thuê, và kết nối với bạn cùng phòng.
            </p>
            <div className="auth-brand__features">
              {[
                { icon: '✨', text: 'Hoàn toàn miễn phí' },
                { icon: '🤖', text: 'AI hỗ trợ viết mô tả' },
                { icon: '🔔', text: 'Thông báo realtime' },
                { icon: '🛡️', text: 'Kiểm duyệt bài đăng' },
              ].map((f) => (
                <div key={f.text} className="auth-brand__feature">
                  <span>{f.icon}</span>
                  <span>{f.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right — Form */}
        <div className="auth-form-panel">
          <div className="auth-form-panel__inner">
            <div className="auth-form-header">
              <h1 className="auth-form-title">Tạo tài khoản</h1>
              <p className="auth-form-subtitle">
                Đã có tài khoản?{' '}
                <Link to="/login" className="auth-link">Đăng nhập</Link>
              </p>
            </div>

            {error && (
              <div className="auth-error animate-scaleIn">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/><path d="M8 5v3M8 10h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                {error}
              </div>
            )}
            {success && (
              <div className="auth-success animate-scaleIn">
                {success}
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form" id="register-form">
              <div className="form-group">
                <label className="form-label" htmlFor="reg-name">Họ và tên</label>
                <div className="form-input-wrapper">
                  <span className="form-input-icon">👤</span>
                  <input
                    id="reg-name" name="full_name" type="text"
                    className="form-input" placeholder="Nguyễn Văn A"
                    value={form.full_name} onChange={handleChange}
                    autoFocus
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reg-email">Email</label>
                <div className="form-input-wrapper">
                  <span className="form-input-icon">✉️</span>
                  <input
                    id="reg-email" name="email" type="email"
                    className="form-input" placeholder="you@example.com"
                    value={form.email} onChange={handleChange}
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reg-password">Mật khẩu</label>
                <div className="auth-pw-wrap">
                  <div className="form-input-wrapper">
                    <span className="form-input-icon">🔒</span>
                    <input
                      id="reg-password" name="password"
                      type={showPw ? 'text' : 'password'}
                      className="form-input" placeholder="Tối thiểu 6 ký tự"
                      value={form.password} onChange={handleChange}
                      autoComplete="new-password"
                    />
                  </div>
                  <button
                    type="button" className="auth-pw-toggle"
                    onClick={() => setShowPw((v) => !v)} tabIndex={-1}
                  >
                    {showPw ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reg-confirm">Xác nhận mật khẩu</label>
                <div className="form-input-wrapper">
                  <span className="form-input-icon">✅</span>
                  <input
                    id="reg-confirm" name="confirmPassword"
                    type={showPw ? 'text' : 'password'}
                    className="form-input" placeholder="Nhập lại mật khẩu"
                    value={form.confirmPassword} onChange={handleChange}
                    autoComplete="new-password"
                  />
                </div>
                {form.confirmPassword && (
                  <p className={`form-hint ${form.password === form.confirmPassword ? 'reg-match' : 'reg-mismatch'}`}>
                    {form.password === form.confirmPassword ? '✅ Mật khẩu khớp' : '❌ Mật khẩu không khớp'}
                  </p>
                )}
              </div>

              {/* Role selector */}
              <div className="form-group">
                <label className="form-label">Bạn là</label>
                <div className="reg-role-grid">
                  {[
                    { value: 'tenant', icon: '🔍', label: 'Người tìm phòng', desc: 'Tìm phòng trọ & bạn ở ghép' },
                    { value: 'landlord', icon: '🏠', label: 'Chủ nhà', desc: 'Đăng tin cho thuê phòng' },
                  ].map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      className={`reg-role-btn ${form.role === r.value ? 'reg-role-btn--active' : ''}`}
                      onClick={() => setForm((p) => ({ ...p, role: r.value }))}
                    >
                      <span className="reg-role-icon">{r.icon}</span>
                      <strong>{r.label}</strong>
                      <span className="reg-role-desc">{r.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-full btn-lg"
                id="btn-register"
                disabled={loading}
              >
                {loading ? (
                  <><span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Đang tạo tài khoản...</>
                ) : (
                  'Tạo tài khoản'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      <style>{registerStyles}</style>
    </div>
  );
};

const registerStyles = `
  /* Inherits auth-page, auth-container, auth-brand, auth-form-panel from Login.jsx */
  .auth-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    position: relative;
  }
  .auth-page__bg {
    position: fixed; inset: 0; z-index: -1;
    background:
      radial-gradient(ellipse 60% 60% at 30% 40%, rgba(13,148,136,.05) 0%, transparent 70%),
      radial-gradient(ellipse 40% 40% at 70% 70%, rgba(245,158,11,.04) 0%, transparent 70%),
      var(--bg-base);
  }
  .auth-container {
    display: flex;
    width: 100%;
    max-width: 920px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-xl);
    overflow: hidden;
    box-shadow: var(--shadow-xl);
  }
  .auth-brand {
    width: 340px; flex-shrink: 0;
    background: linear-gradient(160deg, #0d9488 0%, #0f766e 50%, #115e59 100%);
    padding: 40px 32px;
    display: flex; align-items: center;
    position: relative; overflow: hidden;
  }
  .auth-brand::before {
    content: '';
    position: absolute;
    top: -80px; right: -80px;
    width: 220px; height: 220px;
    border-radius: 50%;
    background: rgba(255,255,255,.06);
  }
  .auth-brand::after {
    content: '';
    position: absolute;
    bottom: -60px; left: -40px;
    width: 160px; height: 160px;
    border-radius: 50%;
    background: rgba(255,255,255,.04);
  }
  .auth-brand__content { position: relative; z-index: 1; }
  .auth-brand__logo { display: flex; align-items: center; gap: 10px; margin-bottom: 28px; }
  .auth-brand__mark {
    width: 36px; height: 36px; border-radius: 8px;
    background: rgba(255,255,255,.2); color: #fff;
    font-weight: 800; font-size: 18px;
    display: flex; align-items: center; justify-content: center;
  }
  .auth-brand__name { color: #fff; font-size: 16px; font-weight: 700; }
  .auth-brand__title { font-size: 22px; font-weight: 800; color: #fff; line-height: 1.25; margin-bottom: 12px; }
  .auth-brand__desc { font-size: 13.5px; color: rgba(255,255,255,.7); line-height: 1.6; margin-bottom: 28px; }
  .auth-brand__features { display: flex; flex-direction: column; gap: 10px; }
  .auth-brand__feature { display: flex; align-items: center; gap: 10px; font-size: 13px; color: rgba(255,255,255,.85); font-weight: 500; }

  .auth-form-panel { flex: 1; padding: 40px 36px; overflow-y: auto; max-height: 90vh; }
  .auth-form-panel__inner { width: 100%; }
  .auth-form-header { margin-bottom: 24px; }
  .auth-form-title { font-size: 24px; font-weight: 800; color: var(--text-primary); margin-bottom: 6px; }
  .auth-form-subtitle { font-size: 14px; color: var(--text-secondary); }
  .auth-link { color: var(--primary); font-weight: 600; }
  .auth-link:hover { color: var(--primary-dark); text-decoration: underline; }

  .auth-error {
    display: flex; align-items: center; gap: 10px;
    padding: 12px 16px;
    background: var(--danger-light); border: 1px solid #fecaca;
    border-radius: var(--radius-md); color: var(--danger);
    font-size: 13px; font-weight: 500; margin-bottom: 16px;
  }
  .auth-success {
    padding: 12px 16px;
    background: var(--success-light); border: 1px solid #bbf7d0;
    border-radius: var(--radius-md); color: var(--success);
    font-size: 13px; font-weight: 500; margin-bottom: 16px;
  }

  .auth-form { display: flex; flex-direction: column; gap: 16px; }

  .auth-pw-wrap { position: relative; }
  .auth-pw-toggle {
    position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
    background: none; border: none; cursor: pointer; font-size: 18px;
    padding: 4px; color: var(--text-muted); z-index: 1;
  }
  .auth-pw-wrap .form-input { padding-right: 48px; }

  .reg-match    { color: var(--success); }
  .reg-mismatch { color: var(--danger); }

  /* Role selector */
  .reg-role-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .reg-role-btn {
    display: flex; flex-direction: column; align-items: center;
    gap: 6px; padding: 16px 12px;
    background: var(--bg-warm);
    border: 1.5px solid var(--border);
    border-radius: var(--radius-md);
    cursor: pointer; transition: var(--transition);
    text-align: center;
    font-family: inherit;
  }
  .reg-role-btn:hover { border-color: var(--border-hover); }
  .reg-role-btn--active {
    border-color: var(--primary);
    background: var(--primary-50);
  }
  .reg-role-icon { font-size: 24px; }
  .reg-role-btn strong { font-size: 14px; color: var(--text-primary); }
  .reg-role-desc { font-size: 12px; color: var(--text-muted); }

  @media(max-width: 768px) {
    .auth-container { flex-direction: column; max-width: 480px; }
    .auth-brand { width: 100%; padding: 28px 24px; }
    .auth-brand__title { font-size: 18px; }
    .auth-brand__features { display: none; }
    .auth-form-panel { padding: 28px 24px; max-height: none; }
  }
`;

export default Register;
