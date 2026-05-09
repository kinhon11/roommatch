import apiClient from '../api/apiClient';
import { supabase } from './supabaseClient';

/**
 * Notification Service — REST + Supabase Realtime
 */
export const notificationService = {
  /** Get all notifications for current user */
  getAll: () => apiClient.get('/notifications'),

  /** Mark a notification as read */
  markRead: (id) => apiClient.patch(`/notifications/${id}/read`),

  /** Mark ALL unread notifications as read (single backend call) */
  markAllRead: () => apiClient.patch('/notifications/mark-all-read'),

  /**
   * Subscribe to realtime notifications for a user.
   * Returns an unsubscribe function.
   * @param {string} userId - Supabase user ID
   * @param {function} onNewNotification - callback(notification)
   */
  subscribeRealtime: (userId, onNewNotification) => {
    if (!userId) return () => {};

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new) onNewNotification(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};
