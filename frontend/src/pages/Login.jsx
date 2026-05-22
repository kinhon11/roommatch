import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      setError('Vui lòng nhập đầy đủ email và mật khẩu.');
      return;
    }
    setLoading(true);
    try {
      const res = await login(form);
      if (res.user?.role === 'admin') navigate('/admin/dashboard');
      else if (res.user?.role === 'broker') navigate('/broker/dashboard');
      else if (res.user?.role === 'landlord') navigate('/landlord/dashboard');
      else navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Đăng nhập thất bại. Kiểm tra lại thông tin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-page__bg" />

      <div className="auth-container animate-slideUp">
        {/* Left — Brand panel */}
        <div className="auth-brand">
          <div className="auth-brand__content">
            <div className="auth-brand__logo">
              <span className="auth-brand__mark">R</span>
              <span className="auth-brand__name">RoommieMatch</span>
            </div>
            <h2 className="auth-brand__title">
              Chào mừng trở lại
            </h2>
            <p className="auth-brand__desc">
              Đăng nhập để tiếp tục tìm phòng trọ và bạn ở ghép phù hợp với bạn.
            </p>
            <div className="auth-brand__features">
              {[
                { icon: '🔍', text: 'Tìm phòng nhanh chóng' },
                { icon: '💬', text: 'Chat trực tiếp với chủ nhà' },
                { icon: '📅', text: 'Đặt lịch xem phòng' },
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
              <h1 className="auth-form-title">Đăng nhập</h1>
              <p className="auth-form-subtitle">
                Chưa có tài khoản?{' '}
                <Link to="/register" className="auth-link">Đăng ký miễn phí</Link>
              </p>
            </div>

            {error && (
              <div className="auth-error animate-scaleIn">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/><path d="M8 5v3M8 10h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form" id="login-form">
              <div className="form-group">
                <label className="form-label" htmlFor="login-email">Email</label>
                <div className="form-input-wrapper">
                  <span className="form-input-icon">✉️</span>
                  <input
                    id="login-email"
                    name="email"
                    type="email"
                    className="form-input"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={handleChange}
                    autoComplete="email"
                    autoFocus
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="login-password">Mật khẩu</label>
                <div className="auth-pw-wrap">
                  <div className="form-input-wrapper">
                    <span className="form-input-icon">🔒</span>
                    <input
                      id="login-password"
                      name="password"
                      type={showPw ? 'text' : 'password'}
                      className="form-input"
                      placeholder="••••••••"
                      value={form.password}
                      onChange={handleChange}
                      autoComplete="current-password"
                    />
                  </div>
                  <button
                    type="button"
                    className="auth-pw-toggle"
                    onClick={() => setShowPw((v) => !v)}
                    tabIndex={-1}
                    aria-label="Hiện/ẩn mật khẩu"
                  >
                    {showPw ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-full btn-lg"
                id="btn-login"
                disabled={loading}
              >
                {loading ? (
                  <><span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Đang đăng nhập...</>
                ) : (
                  'Đăng nhập'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      <style>{loginStyles}</style>
    </div>
  );
};

const loginStyles = `
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
    max-width: 880px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-xl);
    overflow: hidden;
    box-shadow: var(--shadow-xl);
  }

  /* Brand panel */
  .auth-brand {
    width: 360px;
    flex-shrink: 0;
    background: linear-gradient(160deg, #0d9488 0%, #0f766e 50%, #115e59 100%);
    padding: 48px 36px;
    display: flex;
    align-items: center;
    position: relative;
    overflow: hidden;
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
  .auth-brand__logo {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 32px;
  }
  .auth-brand__mark {
    width: 36px; height: 36px;
    border-radius: 8px;
    background: rgba(255,255,255,.2);
    color: #fff;
    font-weight: 800;
    font-size: 18px;
    display: flex; align-items: center; justify-content: center;
  }
  .auth-brand__name { color: #fff; font-size: 16px; font-weight: 700; }
  .auth-brand__title {
    font-size: 24px; font-weight: 800; color: #fff;
    line-height: 1.25; margin-bottom: 12px;
  }
  .auth-brand__desc {
    font-size: 14px; color: rgba(255,255,255,.7);
    line-height: 1.6; margin-bottom: 32px;
  }
  .auth-brand__features { display: flex; flex-direction: column; gap: 12px; }
  .auth-brand__feature {
    display: flex; align-items: center; gap: 10px;
    font-size: 13px; color: rgba(255,255,255,.85); font-weight: 500;
  }

  /* Form panel */
  .auth-form-panel {
    flex: 1;
    padding: 48px 40px;
    display: flex;
    align-items: center;
  }
  .auth-form-panel__inner { width: 100%; }

  .auth-form-header { margin-bottom: 28px; }
  .auth-form-title {
    font-size: 24px; font-weight: 800;
    color: var(--text-primary); margin-bottom: 6px;
  }
  .auth-form-subtitle {
    font-size: 14px; color: var(--text-secondary);
  }
  .auth-link {
    color: var(--primary); font-weight: 600;
    transition: var(--transition);
  }
  .auth-link:hover { color: var(--primary-dark); text-decoration: underline; }

  .auth-error {
    display: flex; align-items: center; gap: 10px;
    padding: 12px 16px;
    background: var(--danger-light);
    border: 1px solid #fecaca;
    border-radius: var(--radius-md);
    color: var(--danger);
    font-size: 13px; font-weight: 500;
    margin-bottom: 20px;
  }

  .auth-form { display: flex; flex-direction: column; gap: 18px; }

  .auth-pw-wrap { position: relative; }
  .auth-pw-toggle {
    position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
    background: none; border: none; cursor: pointer; font-size: 18px;
    padding: 4px; color: var(--text-muted); z-index: 1;
  }
  .auth-pw-toggle:hover { color: var(--text-primary); }
  .auth-pw-wrap .form-input { padding-right: 48px; }

  @media(max-width: 768px) {
    .auth-container { flex-direction: column; max-width: 440px; }
    .auth-brand { width: 100%; padding: 32px 28px; }
    .auth-brand__title { font-size: 20px; }
    .auth-brand__features { display: none; }
    .auth-form-panel { padding: 32px 28px; }
  }
`;

export default Login;

