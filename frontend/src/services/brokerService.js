import apiClient from '../api/apiClient';

export const brokerService = {
  listRooms: () => apiClient.get('/broker/rooms'),
  listLeads: (params = {}) => apiClient.get('/broker/leads', { params }),
  createLead: (payload) => apiClient.post('/broker/leads', payload),
  updateLead: (id, payload) => apiClient.put(`/broker/leads/${id}`, payload),
  updateLeadStatus: (id, status, lost_reason) =>
    apiClient.patch(`/broker/leads/${id}/status`, { status, lost_reason }),
  deleteLead: (id) => apiClient.delete(`/broker/leads/${id}`),
  recommendRoom: (leadId, payload) => apiClient.post(`/broker/leads/${leadId}/rooms`, payload),
  updateRecommendation: (leadId, recommendationId, payload) =>
    apiClient.patch(`/broker/leads/${leadId}/rooms/${recommendationId}`, payload),
  deleteRecommendation: (leadId, recommendationId) =>
    apiClient.delete(`/broker/leads/${leadId}/rooms/${recommendationId}`),
};
