import apiClient from '../api/apiClient';

/**
 * Appointment Service
 */
export const appointmentService = {
  /** Create a new appointment */
  create: (roomId, scheduledAt, tenantId) =>
    apiClient.post('/appointments', { room_id: roomId, scheduled_at: scheduledAt, tenant_id: tenantId }),

  /** Update appointment status (landlord) */
  updateStatus: (appointmentId, status, cancellation_reason) =>
    apiClient.patch(`/appointments/${appointmentId}`, { status, cancellation_reason }),

  /** Reschedule an appointment */
  reschedule: (appointmentId, scheduledAt) =>
    apiClient.patch(`/appointments/${appointmentId}/reschedule`, { scheduled_at: scheduledAt }),

  /** List appointments */
  list: (params = {}) => apiClient.get('/appointments', { params }),
};
