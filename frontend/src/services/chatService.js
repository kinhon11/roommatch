import apiClient from '../api/apiClient';

export const chatService = {
  /** Lấy/tạo conversation */
  getOrCreate: async ({ landlordId = null, tenantId = null, roomId = null } = {}) => {
    const { data } = await apiClient.post('/chat/conversations', {
      landlord_id: landlordId,
      tenant_id: tenantId,
      room_id: roomId,
    });
    return data;
  },

  /** Danh sách tất cả conversations */
  getConversations: async () => {
    const { data } = await apiClient.get('/chat/conversations');
    return data.conversations || [];
  },

  /** Lấy messages trong conversation */
  getMessages: async (convId, page = 1) => {
    const { data } = await apiClient.get(`/chat/conversations/${convId}/messages`, {
      params: { page, limit: 50 },
    });
    return data;
  },

  /** Gửi tin nhắn */
  sendMessage: async (convId, content) => {
    const { data } = await apiClient.post(`/chat/conversations/${convId}/messages`, { content });
    return data.message;
  },

  /** Đếm tin chưa đọc */
  getUnreadCount: async () => {
    const { data } = await apiClient.get('/chat/unread-count');
    return data.unreadCount || 0;
  },
};
