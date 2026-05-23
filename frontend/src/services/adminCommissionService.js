import apiClient from '../api/apiClient';

export const adminCommissionService = {
  list: (params = {}) => apiClient.get('/admin/commissions', { params }),
  updateStatus: (id, status, note) => apiClient.patch(`/admin/commissions/${id}/status`, { status, note }),
};
