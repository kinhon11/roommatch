import apiClient from '../api/apiClient';

export const favoriteService = {
  /** Lấy danh sách phòng yêu thích */
  getFavorites: async () => {
    const { data } = await apiClient.get('/favorites');
    return data;
  },

  /** Kiểm tra phòng đã yêu thích chưa */
  checkFavorite: async (roomId) => {
    const { data } = await apiClient.get(`/favorites/${roomId}/check`);
    return data;
  },

  /** Thêm vào yêu thích */
  addFavorite: async (roomId) => {
    const { data } = await apiClient.post(`/favorites/${roomId}`);
    return data;
  },

  /** Xóa khỏi yêu thích */
  removeFavorite: async (roomId) => {
    const { data } = await apiClient.delete(`/favorites/${roomId}`);
    return data;
  },

  /** Toggle: nếu đã thích thì bỏ thích, ngược lại */
  toggleFavorite: async (roomId, isFavorited) => {
    if (isFavorited) {
      return favoriteService.removeFavorite(roomId);
    }
    return favoriteService.addFavorite(roomId);
  },
};
