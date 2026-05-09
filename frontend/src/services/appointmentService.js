import apiClient from '../api/apiClient';

/**
 * Appointment Service
 */
export const appointmentService = {
  /** Create a new appointment */
  create: (roomId, scheduledAt) => apiClient.post('/appointments', { room_id: roomId, scheduled_at: scheduledAt }),

  /** Update appointment status (landlord) */
  updateStatus: (appointmentId, status) => apiClient.patch(`/appointments/${appointmentId}`, { status }),

  /** List appointments */
  list: (params = {}) => apiClient.get('/appointments', { params }),
};
