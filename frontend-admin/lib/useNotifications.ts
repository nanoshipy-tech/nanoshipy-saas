import { apiClient } from '@/lib/apiClient';
import { useState, useEffect, useCallback } from 'react';

export interface InAppNotificationData {
  id: string;
  title: string;
  body: string;
  link_url: string | null;
  is_read: boolean;
  created_at: string;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<InAppNotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await apiClient.get('/notifications/unread-count');
      if (res.data?.success && res.data?.data) {
        setUnreadCount(res.data.data.unread_count || 0);
      }
    } catch {}
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/notifications?limit=10');
      if (res.data?.success && res.data?.data) {
        const list = res.data.data.notifications || res.data.data || [];
        setNotifications(list);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  const markAsRead = async (id: string) => {
    try {
      const res = await apiClient.put(`/notifications/${id}/read`);
      if (res.data?.success) {
        setNotifications(prev =>
          prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
        );
        setUnreadCount(c => Math.max(0, c - 1));
      }
    } catch {}
  };

  const markAllRead = async () => {
    try {
      const res = await apiClient.put('/notifications/mark-all-read');
      if (res.data?.success) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
      }
    } catch {}
  };

  // Poll unread count and latest list every 30s
  useEffect(() => {
    fetchUnreadCount();
    fetchNotifications();

    const interval = setInterval(() => {
      fetchUnreadCount();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchUnreadCount, fetchNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAllRead,
  };
}
