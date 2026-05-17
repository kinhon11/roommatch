import apiClient from '../api/apiClient';

export const depositService = {
  list: () => apiClient.get('/deposits'),
  create: (data) => apiClient.post('/deposits', data),
  updateStatus: (depositId, status, note) =>
    apiClient.patch(`/deposits/${depositId}/status`, { status, note }),
};
