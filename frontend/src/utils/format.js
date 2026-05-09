/**
 * utils/format.js
 * Các hàm format tiền, ngày, và số
 */

/**
 * Format số tiền sang định dạng VNĐ
 * @param {number} amount - Số tiền (VD: 3500000)
 * @returns {string} - "3.500.000 ₫"
 */
export const formatCurrency = (amount) => {
  if (!amount && amount !== 0) return 'Liên hệ';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    minimumFractionDigits: 0,
  }).format(amount);
};

/**
 * Format ngày sang tiếng Việt
 * @param {string} dateString - ISO date string
 * @returns {string} - "30 tháng 3, 2026"
 */
export const formatDate = (dateString) => {
  if (!dateString) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(dateString));
};

/**
 * Format ngày relative (VD: "2 giờ trước")
 * @param {string} dateString - ISO date string
 * @returns {string} - "2 giờ trước"
 */
export const formatRelativeTime = (dateString) => {
  if (!dateString) return '';
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Vừa xong';
  if (diffMin < 60) return `${diffMin} phút trước`;
  if (diffHour < 24) return `${diffHour} giờ trước`;
  if (diffDay < 7) return `${diffDay} ngày trước`;
  return formatDate(dateString);
};

/**
 * Format diện tích
 * @param {number} area - Diện tích m2
 * @returns {string} - "25 m²"
 */
export const formatArea = (area) => {
  if (!area) return 'N/A';
  return `${area} m²`;
};

/**
 * Rút gọn text
 * @param {string} text - Text đầy đủ
 * @param {number} maxLength - Độ dài tối đa
 * @returns {string}
 */
export const truncateText = (text, maxLength = 100) => {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
};
