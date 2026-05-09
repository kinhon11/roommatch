import apiClient from '../api/apiClient';

export const authService = {
  /**
   * Đăng ký tài khoản mới
   */
  register: async ({ email, password, full_name, role }) => {
    const { data } = await apiClient.post('/auth/register', { email, password, full_name, role });
    return data;
  },

  /**
   * Đăng nhập
   */
  login: async ({ email, password }) => {
    const { data } = await apiClient.post('/auth/login', { email, password });
    return data;
  },

  /**
   * Đăng xuất
   */
  logout: async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // The local session should be cleared even if the server token is already invalid.
    } finally {
      localStorage.removeItem('roommie-session');
      localStorage.removeItem('roommie-user');
    }
  },
};
