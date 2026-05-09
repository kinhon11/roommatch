import { Link } from 'react-router-dom';

const NotFoundPage = () => (
  <div style={{
    minHeight: 'calc(100vh - 80px)',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    textAlign: 'center', padding: '40px 20px',
    background: 'var(--bg-base)',
  }}>
    {/* Animated 404 */}
    <div style={{ position: 'relative', marginBottom: 32 }}>
      <div style={{
        fontSize: 140, fontWeight: 900, lineHeight: 1,
        background: 'linear-gradient(135deg, var(--primary), var(--info))',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        userSelect: 'none',
        animation: 'float 3s ease-in-out infinite',
      }}>
        404
      </div>
      <div style={{ fontSize: 64, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', opacity: .12 }}>
        🏠
      </div>
    </div>

    <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12 }}>
      Trang không tồn tại
    </h1>
    <p style={{ color: 'var(--text-secondary)', fontSize: 16, maxWidth: 440, lineHeight: 1.7, marginBottom: 32 }}>
      Trang bạn đang tìm kiếm không tồn tại, đã bị xóa, hoặc bạn không có quyền truy cập.
    </p>

    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
      <Link to="/" className="btn btn-primary">🏠 Về trang chủ</Link>
      <Link to="/rooms" className="btn btn-secondary">🔍 Tìm phòng</Link>
    </div>

    <style>{`
      @keyframes float {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-12px); }
      }
    `}</style>
  </div>
);

export default NotFoundPage;
