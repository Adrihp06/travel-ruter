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
  isMarkingAllAsRead: false,
  error: null,
  isPanelOpen: false,
  unreadCountRequestVersion: 0,
  pendingUnreadCountBeforeOpen: 0,

  prepareToOpenPanel: () => {
    set((state) => ({
      unreadCount: 0,
      error: null,
      isPanelOpen: true,
      isMarkingAllAsRead: false,
      pendingUnreadCountBeforeOpen: state.unreadCount,
      unreadCountRequestVersion: state.unreadCountRequestVersion + 1,
    }));
  },

  setPanelOpen: (isPanelOpen) => {
    set((state) => ({
      error: null,
      isPanelOpen,
      isMarkingAllAsRead: isPanelOpen ? state.isMarkingAllAsRead : false,
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
      isMarkingAllAsRead: false,
    });
  } catch {
      set({ error: 'loadFailed', isLoading: false, isMarkingAllAsRead: false });
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
    if (get().isMarkingAllAsRead) {
      return false;
    }

    const hasUnread = get().notifications.some((notification) => !notification.is_read);
    if (!hasUnread && get().unreadCount === 0) {
      set({ error: null });
      return true;
    }

    const previousState = get();
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
      unreadCount: 0,
      error: null,
      isMarkingAllAsRead: true,
    }));
    try {
      const resp = await authFetch(`${API_BASE}/notifications/read-all`, { method: 'POST' });
      if (!resp.ok) throw new Error('Failed to mark all notifications as read');
      set({ isMarkingAllAsRead: false, error: null, pendingUnreadCountBeforeOpen: 0 });
      return true;
    } catch {
      set({
        notifications: previousState.notifications,
        unreadCount: previousState.unreadCount,
        error: 'markAllFailed',
        isMarkingAllAsRead: false,
      });
      return false;
    }
  },

  // Coordinated panel-open flow: clears badge immediately, fetches the list
  // without reintroducing stale unreadCount, then attempts to mark the
  // fetched notifications as read without surfacing an automatic error banner.
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

    const failOpenNotifications = () => {
      if (!isActiveOpenRequest()) {
        return false;
      }
      set({
        notifications: [],
        total: 0,
        error: 'loadFailed',
        isLoading: false,
        isMarkingAllAsRead: false,
        pendingUnreadCountBeforeOpen: 0,
        unreadCount: getFailureUnreadCount(get().pendingUnreadCountBeforeOpen),
      });
      return false;
    };

    let resp;
    try {
      resp = await authFetch(`${API_BASE}/notifications/?limit=${limit}&offset=${offset}`);
    } catch {
      return failOpenNotifications();
    }

    if (!resp.ok) {
      return failOpenNotifications();
    }

    let data;
    try {
      data = await resp.json();
    } catch {
      return failOpenNotifications();
    }

    if (!isValidNotificationPayload(data)) {
      return failOpenNotifications();
    }

    if (!isActiveOpenRequest()) {
      return false;
    }

    set({
      notifications: data.notifications,
      total: data.total,
      unreadCount: getFailureUnreadCount(data.unread_count),
      error: null,
      isLoading: false,
      isMarkingAllAsRead: false,
      pendingUnreadCountBeforeOpen: 0,
    });

    if (data.unread_count === 0) {
      return true;
    }

    let markResp;
    try {
      set({ isMarkingAllAsRead: true });
      markResp = await authFetch(`${API_BASE}/notifications/read-all`, { method: 'POST' });
    } catch {
      if (isActiveOpenRequest()) {
        set({ isMarkingAllAsRead: false });
      }
      return false;
    }

    if (!markResp.ok || !isActiveOpenRequest()) {
      if (isActiveOpenRequest()) {
        set({ isMarkingAllAsRead: false });
      }
      return false;
    }

    set({
      notifications: data.notifications.map((n) => ({ ...n, is_read: true })),
      unreadCount: 0,
      error: null,
      isMarkingAllAsRead: false,
    });
    return true;
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
