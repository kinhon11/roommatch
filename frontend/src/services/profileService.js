import apiClient from '../api/apiClient';

export const profileService = {
  /**
   * Lấy thông tin hồ sơ hiện tại
   */
  getProfile: async () => {
    const { data } = await apiClient.get('/profile');
    return data.user;
  },

  /**
   * Cập nhật thông tin hồ sơ
   */
  updateProfile: async (profileData) => {
    const { data } = await apiClient.put('/profile', profileData);
    return data;
  },

  /**
   * Đổi mật khẩu
   */
  changePassword: async (passwordData) => {
    const { data } = await apiClient.put('/profile/change-password', passwordData);
    return data;
  },
};
