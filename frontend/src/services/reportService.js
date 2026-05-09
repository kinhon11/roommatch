import apiClient from '../api/apiClient';

export const reportService = {
  /** Gửi báo cáo vi phạm */
  createReport: async ({ room_id, reason, description }) => {
    const { data } = await apiClient.post('/reports', { room_id, reason, description });
    return data;
  },

  /** Admin: lấy danh sách reports */
  getAllReports: async (params = {}) => {
    const { data } = await apiClient.get('/reports', { params });
    return data;
  },

  /** Admin: xử lý report */
  resolveReport: async (reportId, status) => {
    const { data } = await apiClient.patch(`/reports/${reportId}`, { status });
    return data;
  },
};
