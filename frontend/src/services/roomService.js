import apiClient from '../api/apiClient';

export const roomService = {
  /**
   * Lấy danh sách phòng đã duyệt (có filter nâng cao)
   */
  getApprovedRooms: async (filters = {}) => {
    const { data } = await apiClient.get('/rooms', { params: filters });
    return data;
  },

  /**
   * Lấy chi tiết một phòng
   */
  getRoomById: async (id) => {
    const { data } = await apiClient.get(`/rooms/${id}`);
    return data;
  },

  /**
   * Lấy phòng tương tự
   */
  getSimilarRooms: async (id) => {
    const { data } = await apiClient.get(`/rooms/${id}/similar`);
    return data;
  },

  /**
   * Landlord: Đăng tin phòng mới
   */
  createRoom: async (roomData) => {
    const { data } = await apiClient.post('/rooms', roomData);
    return data;
  },

  /**
   * Landlord: Cập nhật phòng
   */
  updateRoom: async (id, roomData) => {
    const { data } = await apiClient.put(`/rooms/${id}`, roomData);
    return data;
  },

  /**
   * Landlord/Admin: Xóa phòng
   */
  deleteRoom: async (id) => {
    const { data } = await apiClient.delete(`/rooms/${id}`);
    return data;
  },

  /**
   * Landlord: Lấy danh sách phòng của mình
   */
  getMyRooms: async () => {
    const { data } = await apiClient.get('/rooms/my/listings');
    return data;
  },

  /**
   * Admin: Duyệt hoặc từ chối phòng
   */
  updateRoomStatus: async (id, status, rejection_reason) => {
    const { data } = await apiClient.patch(`/rooms/${id}/status`, { status, rejection_reason });
    return data;
  },

  /**
   * Landlord: Bật/tắt ẩn phòng
   */
  toggleRoomHidden: async (id) => {
    const { data } = await apiClient.patch(`/rooms/${id}/toggle-hidden`);
    return data;
  },

  /**
   * Landlord: Bật/tắt còn phòng
   */
  toggleRoomAvailable: async (id, available_slots) => {
    const { data } = await apiClient.patch(`/rooms/${id}/toggle-available`, { available_slots });
    return data;
  },

  /**
   * Landlord: Xóa ảnh phòng
   */
  deleteRoomImage: async (roomId, imageId) => {
    const { data } = await apiClient.delete(`/rooms/${roomId}/images/${imageId}`);
    return data;
  },

  /**
   * Landlord: Đặt ảnh đại diện
   */
  setPrimaryImage: async (roomId, imageId) => {
    const { data } = await apiClient.patch(`/rooms/${roomId}/images/${imageId}/primary`);
    return data;
  },

  /**
   * Public: Xem profile chủ nhà
   */
  getLandlordProfile: async (landlordId) => {
    const { data } = await apiClient.get(`/rooms/landlord/${landlordId}/profile`);
    return data;
  },
};
