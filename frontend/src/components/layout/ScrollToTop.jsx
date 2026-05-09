import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Tự động cuộn về đầu trang mỗi khi chuyển route
 */
const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
};

export default ScrollToTop;
