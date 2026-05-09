import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

/**
 * ProtectedRoute - Bảo vệ route theo trạng thái đăng nhập và role
 * 
 * @param {string[]} allowedRoles - Danh sách roles được phép truy cập (bỏ qua nếu không cần phân quyền)
 * @param {string} redirectPath - Đường dẫn redirect nếu bị từ chối
 */
const ProtectedRoute = ({ children, allowedRoles = [], redirectPath }) => {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  // Hiển thị loading spinner khi đang kiểm tra session
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Đang tải...</p>
      </div>
    );
  }

  // Chưa đăng nhập → chuyển về trang login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Có role restriction nhưng user không có quyền
  if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    const fallback = redirectPath || getRoleFallback(user?.role);
    return <Navigate to={fallback} replace />;
  }

  return children;
};

/**
 * Trả về trang mặc định theo role khi bị từ chối
 */
const getRoleFallback = (role) => {
  switch (role) {
    case 'admin':    return '/admin/dashboard';
    case 'landlord': return '/landlord/dashboard';
    case 'tenant':   return '/';
    default:         return '/';
  }
};

export default ProtectedRoute;
