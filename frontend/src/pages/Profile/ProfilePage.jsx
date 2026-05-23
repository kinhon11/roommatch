import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { profileService } from '../../services/profileService';

/* ─── Avatar helpers ─── */
const AVATARS = ['😊','😎','🧑','👩','🧔','👨','🦸','🧝','🧙','🦊','🐱','🐶'];
const getInitials = (name = '') =>
  name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
const ROLE_MAP = { tenant: '🔍 Người tìm phòng', landlord: '🏠 Chủ nhà', admin: '👑 Quản trị viên' };

/* ─── Tab component ─── */
const TAB_ITEMS = [
  { id: 'info',     icon: '👤', label: 'Thông tin cá nhân' },
  { id: 'security', icon: '🔒', label: 'Bảo mật' },
];

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState('info');

  // --- Info form state
  const [form, setForm] = useState({ full_name: '', phone: '', contact_email: '', zalo: '', facebook_url: '', contact_hours: '', address: '', bio: '' });
  const [saving,  setSaving]  = useState(false);
  const [success, setSuccess] = useState('');
  const [error,   setError]   = useState('');

  // --- Password form state
  const [pwForm,   setPwForm]   = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwOk,     setPwOk]     = useState('');
  const [pwErr,    setPwErr]    = useState('');
  const [showPw,   setShowPw]   = useState({ current: false, newPw: false, confirm: false });

  // --- Avatar picker state
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const avatarRef = useRef(null);

  // Redirect nếu chưa đăng nhập
  useEffect(() => {
    if (!isAuthenticated) navigate('/login');
  }, [isAuthenticated, navigate]);

  // Load dữ liệu user vào form
  useEffect(() => {
    if (user) {
      setForm({
        full_name: user.full_name || '',
        phone: user.phone || '',
        contact_email: user.contact_email || '',
        zalo: user.zalo || '',
        facebook_url: user.facebook_url || '',
        contact_hours: user.contact_hours || '',
        address: user.address || '',
        bio: user.bio || '',
      });
    }
  }, [user]);

  // Đóng avatar picker khi click ngoài
  useEffect(() => {
    const handler = (e) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target)) {
        setShowAvatarPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!user) return null;

  /* ─── Handlers ─── */
  const handleChange = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));
  const handlePwChange = e => setPwForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSaveInfo = async (e) => {
    e.preventDefault();
    setSaving(true); setError(''); setSuccess('');
    try {
      const res = await profileService.updateProfile(form);
      // Cập nhật context để Navbar và các component khác re-render
      updateUser(res.user);
      setSuccess('✅ Cập nhật hồ sơ thành công!');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.response?.data?.error || 'Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwSaving(true); setPwErr(''); setPwOk('');
    try {
      const res = await profileService.changePassword(pwForm);
      setPwOk('✅ ' + res.message);
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
      setTimeout(() => {
        localStorage.removeItem('roommie-session');
        localStorage.removeItem('roommie-user');
        navigate('/login');
      }, 2500);
    } catch (err) {
      setPwErr(err.response?.data?.error || 'Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setPwSaving(false);
    }
  };

  const handleSelectAvatar = async (emoji) => {
    setShowAvatarPicker(false);
    try {
      await profileService.updateProfile({ ...form, avatar_url: emoji });
      updateUser({ avatar_url: emoji });
      setSuccess('✅ Đã đổi avatar!');
      setTimeout(() => setSuccess(''), 3000);
    } catch { /* avatar update may fail silently */ }
  };


  const isEmoji = v => v && [...v].length === 1 && v.codePointAt(0) > 127;

  return (
    <div className="profile-page">
      <div className="container">

        {/* ── Hero Card ── */}
        <div className="prof-hero animate-slideUp">
          <div className="prof-hero-bg" />
          <div className="prof-hero-content">
            {/* Avatar */}
            <div className="prof-avatar-wrap" ref={avatarRef}>
              <div
                id="btn-change-avatar"
                className="prof-avatar"
                onClick={() => setShowAvatarPicker(v => !v)}
                title="Đổi avatar"
              >
                {isEmoji(user.avatar_url) ? (
                  <span className="prof-avatar-emoji">{user.avatar_url}</span>
                ) : (
                  <span className="prof-avatar-initials">{getInitials(user.full_name)}</span>
                )}
                <div className="prof-avatar-overlay">📷</div>
              </div>

              {showAvatarPicker && (
                <div className="prof-avatar-picker animate-scaleIn">
                  <p className="prof-avatar-picker-title">Chọn avatar</p>
                  <div className="prof-avatar-grid">
                    {AVATARS.map(a => (
                      <button key={a} className="prof-avatar-opt" onClick={() => handleSelectAvatar(a)}>
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="prof-hero-info">
              <h1 className="prof-hero-name">{user.full_name}</h1>
              <p className="prof-hero-email">✉️ {user.email}</p>
              <div className="prof-hero-badges">
                <span className="badge badge-role">{ROLE_MAP[user.role] || user.role}</span>
                {user.phone  && <span className="badge badge-ghost">📞 {user.phone}</span>}
                {user.address && <span className="badge badge-ghost">📍 {user.address}</span>}
              </div>
              {user.bio && <p className="prof-hero-bio">"{user.bio}"</p>}
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="prof-tabs animate-fadeIn">
          {TAB_ITEMS.map(t => (
            <button
              key={t.id}
              id={`tab-${t.id}`}
              className={`prof-tab ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ── Panels ── */}
        <div className="prof-panel animate-slideUp">

          {/* ─── INFO TAB ─── */}
          {activeTab === 'info' && (
            <form id="form-update-profile" className="prof-form" onSubmit={handleSaveInfo}>
              <div className="prof-form-grid">

                <div className="prof-form-group">
                  <label htmlFor="full_name">👤 Họ và tên <span className="req">*</span></label>
                  <input
                    id="full_name"
                    name="full_name"
                    type="text"
                    className="input"
                    placeholder="Nguyễn Văn A"
                    value={form.full_name}
                    onChange={handleChange}
                    required
                    minLength={2}
                  />
                </div>

                <div className="prof-form-group">
                  <label htmlFor="email-readonly">✉️ Email</label>
                  <input
                    id="email-readonly"
                    type="email"
                    className="input input-disabled"
                    value={user.email}
                    disabled
                    title="Không thể thay đổi email"
                  />
                  <p className="prof-hint">Email không thể thay đổi sau khi đăng ký.</p>
                </div>

                <div className="prof-form-group">
                  <label htmlFor="phone">📞 Số điện thoại</label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    className="input"
                    placeholder="0912 345 678"
                    value={form.phone}
                    onChange={handleChange}
                  />
                </div>

                <div className="prof-form-group">
                  <label htmlFor="address">📍 Địa chỉ</label>
                  <input
                    id="contact_email"
                    name="contact_email"
                    type="email"
                    className="input"
                    placeholder="lienhe@example.com"
                    value={form.contact_email}
                    onChange={handleChange}
                  />
                </div>

                <div className="prof-form-group">
                  <label htmlFor="zalo">Zalo</label>
                  <input
                    id="zalo"
                    name="zalo"
                    type="text"
                    className="input"
                    placeholder="So Zalo hoac ten Zalo"
                    value={form.zalo}
                    onChange={handleChange}
                  />
                </div>

                <div className="prof-form-group">
                  <label htmlFor="facebook_url">Facebook</label>
                  <input
                    id="facebook_url"
                    name="facebook_url"
                    type="url"
                    className="input"
                    placeholder="https://facebook.com/..."
                    value={form.facebook_url}
                    onChange={handleChange}
                  />
                </div>

                <div className="prof-form-group">
                  <label htmlFor="contact_hours">Gio lien he</label>
                  <input
                    id="contact_hours"
                    name="contact_hours"
                    type="text"
                    className="input"
                    placeholder="8:00 - 21:00"
                    value={form.contact_hours}
                    onChange={handleChange}
                  />
                </div>

                <div className="prof-form-group">
                  <label htmlFor="address">Dia chi</label>
                  <input
                    id="address"
                    name="address"
                    type="text"
                    className="input"
                    placeholder="123 Đường ABC, Quận 1, TP.HCM"
                    value={form.address}
                    onChange={handleChange}
                  />
                </div>

                <div className="prof-form-group prof-form-full">
                  <label htmlFor="bio">📝 Giới thiệu bản thân</label>
                  <textarea
                    id="bio"
                    name="bio"
                    className="input prof-textarea"
                    placeholder="Một vài câu giới thiệu về bạn..."
                    value={form.bio}
                    onChange={handleChange}
                    rows={4}
                    maxLength={300}
                  />
                  <p className="prof-hint">{form.bio?.length || 0}/300 ký tự</p>
                </div>

              </div>

              {error   && <div className="alert alert-error">{error}</div>}
              {success && <div className="alert alert-success">{success}</div>}

              <div className="prof-form-actions">
                <button
                  id="btn-save-profile"
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? '⏳ Đang lưu...' : '💾 Lưu thay đổi'}
                </button>
              </div>
            </form>
          )}

          {/* ─── SECURITY TAB ─── */}
          {activeTab === 'security' && (
            <form id="form-change-password" className="prof-form" onSubmit={handleChangePassword}>
              <div className="prof-security-info">
                <span className="prof-security-icon">🔐</span>
                <div>
                  <strong>Đổi mật khẩu</strong>
                  <p>Sau khi đổi mật khẩu thành công, bạn sẽ được đăng xuất và cần đăng nhập lại.</p>
                </div>
              </div>

              <div className="prof-form-grid prof-form-single">
                {[
                  { id: 'current_password', name: 'current_password', label: '🔑 Mật khẩu hiện tại', key: 'current' },
                  { id: 'new_password',     name: 'new_password',     label: '🔒 Mật khẩu mới (tối thiểu 6 ký tự)', key: 'newPw' },
                  { id: 'confirm_password', name: 'confirm_password', label: '✅ Xác nhận mật khẩu mới', key: 'confirm' },
                ].map(field => (
                  <div key={field.id} className="prof-form-group">
                    <label htmlFor={field.id}>{field.label} <span className="req">*</span></label>
                    <div className="prof-pw-wrap">
                      <input
                        id={field.id}
                        name={field.name}
                        type={showPw[field.key] ? 'text' : 'password'}
                        className="input"
                        placeholder="••••••••"
                        value={pwForm[field.name]}
                        onChange={handlePwChange}
                        required
                        minLength={field.name !== 'current_password' ? 6 : undefined}
                      />
                      <button
                        type="button"
                        className="prof-pw-toggle"
                        onClick={() => setShowPw(p => ({ ...p, [field.key]: !p[field.key] }))}
                        aria-label="Hiện/ẩn mật khẩu"
                      >
                        {showPw[field.key] ? '🙈' : '👁️'}
                      </button>
                    </div>

                    {/* Strength bar cho new_password */}
                    {field.name === 'new_password' && pwForm.new_password && (
                      <PasswordStrength password={pwForm.new_password} />
                    )}

                    {/* Match hint cho confirm */}
                    {field.name === 'confirm_password' && pwForm.confirm_password && (
                      <p className={`prof-hint ${pwForm.new_password === pwForm.confirm_password ? 'hint-ok' : 'hint-err'}`}>
                        {pwForm.new_password === pwForm.confirm_password ? '✅ Mật khẩu khớp' : '❌ Mật khẩu không khớp'}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {pwErr && <div className="alert alert-error">{pwErr}</div>}
              {pwOk  && <div className="alert alert-success">{pwOk}</div>}

              <div className="prof-form-actions">
                <button
                  id="btn-change-password"
                  type="submit"
                  className="btn btn-primary"
                  disabled={pwSaving}
                >
                  {pwSaving ? '⏳ Đang xử lý...' : '🔑 Đổi mật khẩu'}
                </button>
              </div>
            </form>
          )}
        </div>

      </div>

      <style>{`
        /* ── Layout ── */
        .profile-page { padding: 32px 0 80px; min-height: 100vh; }

        /* ── Hero Card ── */
        .prof-hero {
          position: relative;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          overflow: hidden;
          margin-bottom: 24px;
        }
        .prof-hero-bg {
          position: absolute; inset: 0; height: 120px;
          background: linear-gradient(135deg, var(--primary) 0%, var(--info) 100%);
          opacity: .85;
        }
        .prof-hero-content {
          position: relative;
          display: flex;
          align-items: flex-end;
          gap: 24px;
          padding: 100px 32px 28px;
          flex-wrap: wrap;
        }

        /* ── Avatar ── */
        .prof-avatar-wrap { position: relative; flex-shrink: 0; }
        .prof-avatar {
          width: 100px; height: 100px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--primary), var(--info));
          border: 4px solid var(--bg-card);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          transition: var(--transition);
          box-shadow: 0 8px 32px rgba(13,148,136,.25);
          margin-top: -50px;
        }
        .prof-avatar:hover { transform: scale(1.05); }
        .prof-avatar:hover .prof-avatar-overlay { opacity: 1; }
        .prof-avatar-emoji    { font-size: 52px; line-height: 1; }
        .prof-avatar-initials { font-size: 34px; font-weight: 900; color: #fff; letter-spacing: 1px; }
        .prof-avatar-overlay {
          position: absolute; inset: 0;
          background: rgba(0,0,0,.55);
          display: flex; align-items: center; justify-content: center;
          font-size: 24px; opacity: 0;
          transition: var(--transition);
          border-radius: 50%;
        }

        /* Avatar picker */
        .prof-avatar-picker {
          position: absolute; top: 115px; left: 0; z-index: 99;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 16px;
          box-shadow: var(--shadow-xl);
          min-width: 220px;
        }
        .prof-avatar-picker-title { font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: .5px; margin-bottom: 10px; }
        .prof-avatar-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; }
        .prof-avatar-opt {
          width: 36px; height: 36px; font-size: 22px;
          background: var(--bg-hover); border: 1px solid transparent;
          border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: var(--transition);
        }
        .prof-avatar-opt:hover { background: var(--primary-50); border-color: var(--primary); transform: scale(1.15); }

        /* ── Hero info ── */
        .prof-hero-info { flex: 1; min-width: 0; }
        .prof-hero-name { font-size: 24px; font-weight: 800; color: var(--text-primary); margin-bottom: 4px; }
        .prof-hero-email { font-size: 14px; color: var(--text-secondary); margin-bottom: 10px; }
        .prof-hero-badges { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
        .badge-role { background: var(--primary-50); color: var(--primary-dark); border: 1px solid var(--primary-100); border-radius: 20px; padding: 4px 12px; font-size: 13px; font-weight: 600; }
        .badge-ghost { background: var(--bg-hover); color: var(--text-secondary); border: 1px solid var(--border); border-radius: 20px; padding: 4px 12px; font-size: 12px; }
        .prof-hero-bio { font-size: 13px; color: var(--text-muted); font-style: italic; margin-top: 6px; }

        /* ── Tabs ── */
        .prof-tabs {
          display: flex; gap: 4px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 6px;
          margin-bottom: 20px;
        }
        .prof-tab {
          flex: 1; padding: 10px 20px;
          background: transparent;
          border: none; border-radius: var(--radius);
          color: var(--text-secondary);
          font-size: 14px; font-weight: 600;
          cursor: pointer; transition: var(--transition);
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .prof-tab:hover { background: var(--bg-hover); color: var(--text-primary); }
        .prof-tab.active { background: var(--primary); color: #fff; box-shadow: 0 4px 16px rgba(13,148,136,.25); }

        /* ── Panel ── */
        .prof-panel {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          padding: 32px;
        }
        @media(max-width:640px) { .prof-panel { padding: 20px 16px; } }

        /* ── Form ── */
        .prof-form { display: flex; flex-direction: column; gap: 0; }
        .prof-form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
        }
        @media(max-width:700px){ .prof-form-grid { grid-template-columns: 1fr; } }
        .prof-form-full { grid-column: 1 / -1; }
        .prof-form-single { grid-template-columns: 1fr; max-width: 480px; }

        .prof-form-group { display: flex; flex-direction: column; gap: 6px; }
        .prof-form-group label { font-size: 13px; font-weight: 600; color: var(--text-secondary); }
        .req { color: #ef4444; }

        .input-disabled { opacity: .5; cursor: not-allowed; }
        .prof-textarea { resize: vertical; min-height: 100px; font-family: inherit; }
        .prof-hint { font-size: 12px; color: var(--text-muted); }
        .hint-ok { color: #10b981; }
        .hint-err { color: #ef4444; }

        .prof-form-actions { display: flex; justify-content: flex-end; margin-top: 8px; }

        /* ── Password field ── */
        .prof-pw-wrap { position: relative; }
        .prof-pw-wrap .input { padding-right: 48px; }
        .prof-pw-toggle {
          position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer; font-size: 18px;
          color: var(--text-muted); transition: var(--transition); padding: 4px;
        }
        .prof-pw-toggle:hover { color: var(--text-primary); }

        /* ── Security info box ── */
        .prof-security-info {
          display: flex; align-items: flex-start; gap: 16px;
          background: rgba(6,182,212,.08);
          border: 1px solid rgba(6,182,212,.2);
          border-radius: var(--radius-lg);
          padding: 16px 20px;
          margin-bottom: 24px;
        }
        .prof-security-icon { font-size: 28px; flex-shrink: 0; }
        .prof-security-info strong { display: block; font-size: 15px; color: var(--text-primary); margin-bottom: 4px; }
        .prof-security-info p { font-size: 13px; color: var(--text-secondary); }

        /* ── Alerts ── */
        .alert { padding: 12px 16px; border-radius: var(--radius); font-size: 14px; margin-bottom: 16px; }
        .alert-error   { background: var(--danger-light); border: 1px solid #fecaca; color: var(--danger); }
        .alert-success { background: var(--success-light); border: 1px solid #bbf7d0; color: var(--success); }

        /* ── Animations ── */
        @keyframes slideUp   { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:none } }
        @keyframes fadeIn    { from { opacity:0 } to { opacity:1 } }
        @keyframes scaleIn   { from { opacity:0; transform:scale(.92) } to { opacity:1; transform:none } }
        .animate-slideUp  { animation: slideUp .4s ease both; }
        .animate-fadeIn   { animation: fadeIn .4s ease both; }
        .animate-scaleIn  { animation: scaleIn .2s ease both; }
      `}</style>
    </div>
  );
};

/* ── Password Strength Meter ── */
const PasswordStrength = ({ password }) => {
  const getStrength = (pw) => {
    let score = 0;
    if (pw.length >= 6)  score++;
    if (pw.length >= 10) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return score;
  };
  const score = getStrength(password);
  const labels = ['', 'Rất yếu', 'Yếu', 'Trung bình', 'Mạnh', 'Rất mạnh'];
  const colors = ['', '#ef4444', '#f97316', '#f59e0b', '#10b981', '#06b6d4'];
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {[1,2,3,4,5].map(i => (
          <div key={i} style={{
            flex: 1, height: 4, borderRadius: 2,
            background: i <= score ? colors[score] : 'var(--border)',
            transition: 'background .3s',
          }} />
        ))}
      </div>
      <p style={{ fontSize: 12, color: colors[score], marginTop: 4 }}>{labels[score]}</p>
    </div>
  );
};

export default ProfilePage;
