import { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import NotificationBell from '../notifications/NotificationBell';

/* ── Avatar helper ── */
const NavAvatar = ({ user, size = 34 }) => {
  const isEmoji = (v) => v && [...v].length === 1 && v.codePointAt(0) > 127;
  const initial = (user?.full_name || 'U')[0].toUpperCase();
  return (
    <div className="nav-avatar" style={{ width: size, height: size }}>
      {isEmoji(user?.avatar_url) ? (
        <span className="nav-avatar__emoji">{user.avatar_url}</span>
      ) : user?.avatar_url?.startsWith('http') ? (
        <img src={user.avatar_url} alt="" />
      ) : (
        <span className="nav-avatar__initial">{initial}</span>
      )}
    </div>
  );
};

const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const dropdownRef = useRef(null);

  // Scroll detection for subtle elevation change
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
    setDropdownOpen(false);
    setMobileOpen(false);
  };

  const closeMobile = () => setMobileOpen(false);

  const navLinks = (isAuthenticated
    ? user?.role === 'admin'
      ? [
          { to: '/admin/dashboard', label: 'Admin', icon: '🛡️' },
          { to: '/assistant', label: 'AI trợ lý', icon: '🤖' },
        ]
      : user?.role === 'landlord' || user?.role === 'broker'
        ? [
            { to: '/landlord/dashboard', label: 'Dashboard', icon: '📊' },
            { to: '/landlord/post', label: 'Đăng tin', icon: '✏️' },
            { to: '/broker/leads', label: 'Lead', icon: '📋' },
            { to: '/assistant', label: 'AI trợ lý', icon: '🤖' },
            { to: '/appointments', label: 'Lịch hẹn', icon: '📅' },
            { to: '/chat', label: 'Chat', icon: '💬' },
          ]
        : [
            { to: '/rooms', label: 'Tìm phòng', icon: '🔍' },
            { to: '/favorites', label: 'Yêu thích', icon: '❤️' },
            { to: '/assistant', label: 'AI trợ lý', icon: '🤖' },
            { to: '/my-requests', label: 'Ở ghép', icon: '🤝' },
            { to: '/appointments', label: 'Lịch hẹn', icon: '📅' },
            { to: '/chat', label: 'Chat', icon: '💬' },
          ]
    : [])
      .filter((link) => user?.role !== 'broker' || link.to !== '/landlord/post')
      .filter((link) => user?.role === 'broker' || link.to !== '/broker/leads')
      .map((link) => user?.role === 'broker' && link.to === '/landlord/dashboard' ? { ...link, to: '/broker/dashboard' } : link);

  return (
    <>
      <nav className={`navbar ${scrolled ? 'navbar--elevated' : ''}`} id="main-navbar">
        <div className="navbar__inner">
          {/* Logo */}
          <Link to="/" className="navbar__brand" id="brand-link" onClick={closeMobile}>
            <span className="navbar__logo-mark">R</span>
            <span className="navbar__logo-text">RoommieMatch</span>
          </Link>

          {/* Desktop Nav */}
          <div className="navbar__links">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                id={`nav-${link.label.toLowerCase().replace(/\s/g, '-')}`}
                className={({ isActive }) =>
                  `navbar__link ${isActive ? 'navbar__link--active' : ''}`
                }
              >
                <span className="navbar__link-icon">{link.icon}</span>
                {link.label}
              </NavLink>
            ))}
          </div>

          {/* Right side */}
          <div className="navbar__actions">
            {isAuthenticated ? (
              <>
                <NotificationBell />

                <div className="navbar__user-wrap" ref={dropdownRef}>
                  <button
                    id="btn-user-menu"
                    className="navbar__user-btn"
                    onClick={() => setDropdownOpen((v) => !v)}
                    aria-expanded={dropdownOpen}
                    aria-haspopup="true"
                  >
                    <NavAvatar user={user} />
                    <span className="navbar__user-name">{user?.full_name?.split(' ').pop()}</span>
                    <svg className={`navbar__chevron ${dropdownOpen ? 'open' : ''}`} width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>

                  {dropdownOpen && (
                    <div className="navbar__dropdown animate-scaleIn">
                      <div className="navbar__dropdown-header">
                        <NavAvatar user={user} size={40} />
                        <div>
                          <p className="navbar__dropdown-name">{user?.full_name}</p>
                          <p className="navbar__dropdown-email">{user?.email}</p>
                        </div>
                      </div>
                      <div className="navbar__dropdown-divider" />
                      <Link to="/profile" className="navbar__dropdown-item" onClick={() => setDropdownOpen(false)}>
                        👤 Hồ sơ cá nhân
                      </Link>
                      <Link to="/notifications" className="navbar__dropdown-item" onClick={() => setDropdownOpen(false)}>
                        🔔 Thông báo
                      </Link>
                      {(user?.role === 'landlord' || user?.role === 'broker') && (
                        <Link to="/landlord/my-rooms" className="navbar__dropdown-item" onClick={() => setDropdownOpen(false)}>
                          🏠 Phòng của tôi
                        </Link>
                      )}
                      <div className="navbar__dropdown-divider" />
                      <button className="navbar__dropdown-item navbar__dropdown-item--danger" onClick={handleLogout}>
                        🚪 Đăng xuất
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="navbar__auth-actions">
                <Link to="/login" className="btn btn-ghost btn-sm" id="nav-login">Đăng nhập</Link>
                <Link to="/assistant" className="btn btn-secondary btn-sm" id="nav-assistant">🤖 AI trợ lý</Link>
                <Link to="/register" className="btn btn-primary btn-sm" id="nav-register">Đăng ký</Link>
              </div>
            )}

            {/* Mobile toggle */}
            <button
              className={`navbar__burger ${mobileOpen ? 'open' : ''}`}
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Menu"
              id="btn-mobile-menu"
            >
              <span /><span /><span />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <>
          <div className="navbar__mobile-backdrop animate-fadeIn" onClick={closeMobile} />
          <div className="navbar__mobile animate-slideDown">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `navbar__mobile-link ${isActive ? 'navbar__mobile-link--active' : ''}`
                }
                onClick={closeMobile}
              >
                <span>{link.icon}</span>
                {link.label}
              </NavLink>
            ))}
            {!isAuthenticated && (
              <div className="navbar__mobile-auth">
                <Link to="/assistant" className="btn btn-secondary btn-full" onClick={closeMobile}>🤖 AI trợ lý</Link>
                <Link to="/login" className="btn btn-ghost btn-full" onClick={closeMobile}>Đăng nhập</Link>
                <Link to="/register" className="btn btn-primary btn-full" onClick={closeMobile}>Đăng ký</Link>
              </div>
            )}
          </div>
        </>
      )}

      <style>{navbarStyles}</style>
    </>
  );
};

const navbarStyles = `
  /* ── Navbar Shell ── */
  .navbar {
    position: fixed;
    top: 0; left: 0; right: 0;
    z-index: var(--z-sticky);
    height: 64px;
    background: rgba(255,255,255,.88);
    backdrop-filter: blur(16px) saturate(180%);
    -webkit-backdrop-filter: blur(16px) saturate(180%);
    border-bottom: 1px solid transparent;
    transition: border-color .25s, box-shadow .25s;
  }
  .navbar--elevated {
    border-bottom-color: var(--border);
    box-shadow: 0 1px 3px rgba(26,35,50,.04);
  }

  .navbar__inner {
    max-width: 1280px;
    margin: 0 auto;
    padding: 0 24px;
    height: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* ── Brand ── */
  .navbar__brand {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-right: 8px;
    flex-shrink: 0;
  }
  .navbar__logo-mark {
    width: 32px; height: 32px;
    border-radius: 8px;
    background: var(--primary);
    color: #fff;
    font-weight: 800;
    font-size: 16px;
    display: flex; align-items: center; justify-content: center;
    letter-spacing: 0;
  }
  .navbar__logo-text {
    font-size: 17px;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.02em;
  }

  /* ── Nav Links ── */
  .navbar__links {
    display: flex;
    align-items: center;
    gap: 2px;
    margin-left: auto;
    margin-right: 12px;
  }
  .navbar__link {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 7px 13px;
    border-radius: var(--radius-sm);
    font-size: 13.5px;
    font-weight: 500;
    color: var(--text-secondary);
    transition: var(--transition);
    white-space: nowrap;
  }
  .navbar__link:hover {
    color: var(--text-primary);
    background: var(--bg-hover);
  }
  .navbar__link--active {
    color: var(--primary-dark);
    background: var(--primary-50);
    font-weight: 600;
  }
  .navbar__link-icon { font-size: 14px; }

  /* ── Actions ── */
  .navbar__actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .navbar__auth-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* ── User Button ── */
  .navbar__user-wrap { position: relative; }
  .navbar__user-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 10px 4px 4px;
    border: 1px solid var(--border);
    border-radius: var(--radius-full);
    background: var(--bg-surface);
    color: var(--text-secondary);
    font-size: 13px;
    font-weight: 500;
    transition: var(--transition);
  }
  .navbar__user-btn:hover {
    border-color: var(--border-hover);
    background: var(--bg-hover);
  }

  .nav-avatar {
    border-radius: 50%;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);
    color: #fff;
    font-weight: 700;
    flex-shrink: 0;
  }
  .nav-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .nav-avatar__emoji { font-size: 18px; line-height: 1; }
  .nav-avatar__initial { font-size: 14px; }

  .navbar__user-name { max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .navbar__chevron {
    transition: transform .2s var(--ease-out);
    color: var(--text-muted);
  }
  .navbar__chevron.open { transform: rotate(180deg); }

  /* ── Dropdown ── */
  .navbar__dropdown {
    position: absolute;
    right: 0;
    top: calc(100% + 8px);
    width: 260px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-float);
    overflow: hidden;
    z-index: var(--z-dropdown);
    transform-origin: top right;
  }
  .navbar__dropdown-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
  }
  .navbar__dropdown-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }
  .navbar__dropdown-email {
    font-size: 12px;
    color: var(--text-muted);
    margin-top: 1px;
  }
  .navbar__dropdown-divider {
    height: 1px;
    background: var(--border);
    margin: 0 12px;
  }
  .navbar__dropdown-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
    transition: var(--transition);
    cursor: pointer;
    border: none;
    background: none;
    width: 100%;
    text-align: left;
    font-family: inherit;
  }
  .navbar__dropdown-item:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
  .navbar__dropdown-item--danger:hover {
    background: var(--danger-light);
    color: var(--danger);
  }

  /* ── Hamburger ── */
  .navbar__burger {
    display: none;
    flex-direction: column;
    gap: 5px;
    padding: 8px;
    background: none;
    border: none;
    cursor: pointer;
  }
  .navbar__burger span {
    display: block;
    width: 20px;
    height: 2px;
    background: var(--text-primary);
    border-radius: 1px;
    transition: var(--transition);
    transform-origin: center;
  }
  .navbar__burger.open span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
  .navbar__burger.open span:nth-child(2) { opacity: 0; }
  .navbar__burger.open span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

  /* ── Mobile ── */
  .navbar__mobile-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(26,35,50,.3);
    z-index: calc(var(--z-sticky) - 1);
    backdrop-filter: blur(4px);
  }
  .navbar__mobile {
    position: fixed;
    top: 64px; left: 0; right: 0;
    background: var(--bg-card);
    border-bottom: 1px solid var(--border);
    box-shadow: var(--shadow-lg);
    z-index: var(--z-sticky);
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: calc(100vh - 64px);
    overflow-y: auto;
  }
  .navbar__mobile-link {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    font-size: 15px;
    font-weight: 500;
    color: var(--text-secondary);
    border-radius: var(--radius-md);
    transition: var(--transition);
  }
  .navbar__mobile-link:hover { background: var(--bg-hover); color: var(--text-primary); }
  .navbar__mobile-link--active { background: var(--primary-50); color: var(--primary-dark); font-weight: 600; }

  .navbar__mobile-auth {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--border);
  }

  /* ── Responsive ── */
  @media (max-width: 768px) {
    .navbar__links { display: none; }
    .navbar__burger { display: flex; }
    .navbar__user-name { display: none; }
    .navbar__auth-actions { display: none; }
  }
`;

export default Navbar;
