import { create } from 'zustand';
import useAuthStore from './useAuthStore';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const authFetch = async (url, options = {}) => {
  const token = useAuthStore.getState().getToken();
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
};

const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  total: 0,
  isLoading: false,

  fetchNotifications: async (limit = 20, offset = 0) => {
    set({ isLoading: true });
    try {
      const resp = await authFetch(`${API_BASE}/notifications/?limit=${limit}&offset=${offset}`);
      if (!resp.ok) throw new Error('Failed to fetch notifications');
      const data = await resp.json();
      set({
        notifications: data.notifications,
        total: data.total,
        unreadCount: data.unread_count,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  markAsRead: async (notificationId) => {
    const resp = await authFetch(`${API_BASE}/notifications/${notificationId}/read`, {
      method: 'PATCH',
    });
    if (!resp.ok) return;
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === notificationId ? { ...n, is_read: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }));
  },

  markAllAsRead: async () => {
    await authFetch(`${API_BASE}/notifications/read-all`, { method: 'POST' });
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
      unreadCount: 0,
    }));
  },

  fetchUnreadCount: async () => {
    try {
      const resp = await authFetch(`${API_BASE}/notifications/unread-count`);
      if (!resp.ok) return;
      const data = await resp.json();
      set({ unreadCount: data.count });
    } catch {
      // ignore
    }
  },

  addNotification: (notification) => {
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
      total: state.total + 1,
    }));
  },
}));

export default useNotificationStore;
