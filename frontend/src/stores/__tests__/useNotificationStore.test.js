import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import useNotificationStore from '../useNotificationStore';

vi.mock('../useAuthStore', () => ({
  default: { getState: () => ({ getToken: () => 'test-token' }) },
}));

describe('useNotificationStore', () => {
  beforeEach(() => {
    useNotificationStore.setState({ notifications: [], unreadCount: 0, total: 0, isLoading: false });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetch notifications', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          notifications: [{ id: 1, title: 'Test', is_read: false }],
          total: 1,
          unread_count: 1,
        }),
      })
    );
    await useNotificationStore.getState().fetchNotifications();
    expect(useNotificationStore.getState().notifications).toHaveLength(1);
    expect(useNotificationStore.getState().unreadCount).toBe(1);
  });

  it('mark notification read', async () => {
    useNotificationStore.setState({
      notifications: [{ id: 1, is_read: false }],
      unreadCount: 1,
    });
    global.fetch = vi.fn(() => Promise.resolve({ ok: true }));
    await useNotificationStore.getState().markAsRead(1);
    const state = useNotificationStore.getState();
    expect(state.notifications[0].is_read).toBe(true);
    expect(state.unreadCount).toBe(0);
  });

  it('unread count updates', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ count: 5 }) })
    );
    await useNotificationStore.getState().fetchUnreadCount();
    expect(useNotificationStore.getState().unreadCount).toBe(5);
  });
});
