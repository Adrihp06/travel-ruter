import { create } from 'zustand';
import authFetch from '../utils/authFetch';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

function isValidNotificationPayload(data) {
  return (
    data &&
    Array.isArray(data.notifications) &&
    Number.isFinite(data.total) &&
    Number.isFinite(data.unread_count)
  );
}

function isValidUnreadCountPayload(data) {
  return data && Number.isFinite(data.count) && data.count >= 0;
}

const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  total: 0,
  isLoading: false,
  error: null,
  isPanelOpen: false,
  unreadCountRequestVersion: 0,
  pendingUnreadCountBeforeOpen: 0,

  prepareToOpenPanel: () => {
    set((state) => ({
      unreadCount: 0,
      error: null,
      isPanelOpen: true,
      pendingUnreadCountBeforeOpen: state.unreadCount,
      unreadCountRequestVersion: state.unreadCountRequestVersion + 1,
    }));
  },

  setPanelOpen: (isPanelOpen) => {
    set((state) => ({
      error: null,
      isPanelOpen,
      pendingUnreadCountBeforeOpen: isPanelOpen ? state.pendingUnreadCountBeforeOpen : 0,
      unreadCountRequestVersion: isPanelOpen
        ? state.unreadCountRequestVersion
        : state.unreadCountRequestVersion + 1,
    }));
  },

  fetchNotifications: async (limit = 20, offset = 0) => {
    set({ isLoading: true, error: null });
    try {
      const resp = await authFetch(`${API_BASE}/notifications/?limit=${limit}&offset=${offset}`);
      if (!resp.ok) throw new Error('Failed to fetch notifications');
      const data = await resp.json();
      if (!isValidNotificationPayload(data)) throw new Error('Invalid notification payload');
      set({
        notifications: data.notifications,
        total: data.total,
        unreadCount: data.unread_count,
        isLoading: false,
      });
    } catch {
      set({ error: 'loadFailed', isLoading: false });
    }
  },

  markAsRead: async (notificationId) => {
    let resp;
    try {
      resp = await authFetch(`${API_BASE}/notifications/${notificationId}/read`, {
        method: 'PATCH',
      });
    } catch {
      set({ error: 'markReadFailed' });
      return false;
    }
    if (!resp.ok) {
      set({ error: 'markReadFailed' });
      return false;
    }
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === notificationId ? { ...n, is_read: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
      error: null,
    }));
    return true;
  },

  markAllAsRead: async () => {
    const previousState = get();
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
      unreadCount: 0,
      error: null,
    }));
    try {
      const resp = await authFetch(`${API_BASE}/notifications/read-all`, { method: 'POST' });
      if (!resp.ok) throw new Error('Failed to mark all notifications as read');
      return true;
    } catch {
      set({
        notifications: previousState.notifications,
        unreadCount: previousState.unreadCount,
        error: 'markAllFailed',
      });
      return false;
    }
  },

  // Coordinated panel-open flow: clears badge immediately, fetches list
  // without reintroducing stale unreadCount, and marks all as read server-side.
  openNotifications: async (limit = 20, offset = 0) => {
    if (!get().isPanelOpen) {
      get().prepareToOpenPanel();
    }

    const panelRequestVersion = get().unreadCountRequestVersion;
    set({ error: null, isLoading: true });

    const isActiveOpenRequest = () => {
      const state = get();
      return state.isPanelOpen && state.unreadCountRequestVersion === panelRequestVersion;
    };

    const getFailureUnreadCount = (fallbackUnreadCount) => {
      const state = get();
      if (!state.isPanelOpen || state.unreadCountRequestVersion !== panelRequestVersion) {
        return state.unreadCount;
      }
      return fallbackUnreadCount;
    };

    const failOpenNotifications = (markSucceeded) => {
      if (!isActiveOpenRequest()) {
        return false;
      }
      set({
        notifications: [],
        total: 0,
        error: 'loadFailed',
        isLoading: false,
        pendingUnreadCountBeforeOpen: 0,
        unreadCount: markSucceeded ? 0 : getFailureUnreadCount(get().pendingUnreadCountBeforeOpen),
      });
      return false;
    };

    const [fetchResult, markResult] = await Promise.allSettled([
      authFetch(`${API_BASE}/notifications/?limit=${limit}&offset=${offset}`),
      authFetch(`${API_BASE}/notifications/read-all`, { method: 'POST' }),
    ]);

    if (fetchResult.status === 'rejected') {
      const markSucceeded = markResult.status === 'fulfilled' && markResult.value.ok;
      return failOpenNotifications(markSucceeded);
    }

    const resp = fetchResult.value;
    if (!resp.ok) {
      const markSucceeded = markResult.status === 'fulfilled' && markResult.value.ok;
      return failOpenNotifications(markSucceeded);
    }

    let data;
    try {
      data = await resp.json();
    } catch {
      const markSucceeded = markResult.status === 'fulfilled' && markResult.value.ok;
      return failOpenNotifications(markSucceeded);
    }

    if (!isValidNotificationPayload(data)) {
      const markSucceeded = markResult.status === 'fulfilled' && markResult.value.ok;
      return failOpenNotifications(markSucceeded);
    }

    if (!isActiveOpenRequest()) {
      return false;
    }

    if (markResult.status === 'fulfilled' && markResult.value.ok) {
      set({
        notifications: data.notifications.map((n) => ({ ...n, is_read: true })),
        total: data.total,
        unreadCount: 0,
        error: null,
        isLoading: false,
        pendingUnreadCountBeforeOpen: 0,
      });
      return true;
    }

    set({
      notifications: data.notifications,
      total: data.total,
      unreadCount: getFailureUnreadCount(data.unread_count),
      error: 'markAllFailed',
      isLoading: false,
      pendingUnreadCountBeforeOpen: 0,
    });
    return false;
  },

  fetchUnreadCount: async () => {
    const requestVersion = get().unreadCountRequestVersion;
    try {
      const resp = await authFetch(`${API_BASE}/notifications/unread-count`);
      if (!resp.ok) return;
      const data = await resp.json();
      if (!isValidUnreadCountPayload(data)) return;
      if (get().isPanelOpen || get().unreadCountRequestVersion !== requestVersion) {
        return;
      }
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
