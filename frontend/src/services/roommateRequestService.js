import apiClient from '../api/apiClient';

/**
 * Roommate Request Service
 */
export const roommateRequestService = {
  /** Create a new roommate request with details */
  create: (data) => apiClient.post('/roommate-requests', data),

  /** Update request status (landlord: accept/reject with optional rejection_reason) */
  updateStatus: (requestId, status, rejection_reason) =>
    apiClient.patch(`/roommate-requests/${requestId}`, { status, rejection_reason }),

  /** Cancel own pending request (tenant) */
  cancel: (requestId) => apiClient.delete(`/roommate-requests/${requestId}`),

  /** Get requests: tenant's own or landlord's for a room */
  list: (params = {}) => apiClient.get('/roommate-requests', { params }),

  /** Check tenant's request status for a specific room */
  checkStatus: (roomId) => apiClient.get(`/roommate-requests/check/${roomId}`),
};
