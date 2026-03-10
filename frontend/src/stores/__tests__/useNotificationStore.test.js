import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import useNotificationStore from '../useNotificationStore';

vi.mock('../useAuthStore', () => ({
  default: { getState: () => ({ getToken: () => 'test-token' }) },
}));

describe('useNotificationStore', () => {
  beforeEach(() => {
    useNotificationStore.setState({
      notifications: [],
      unreadCount: 0,
      total: 0,
      isLoading: false,
      isMarkingAllAsRead: false,
      error: null,
      isPanelOpen: false,
      unreadCountRequestVersion: 0,
      pendingUnreadCountBeforeOpen: 0,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetch notifications', async () => {
    globalThis.fetch = vi.fn(() =>
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
    globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true }));
    await useNotificationStore.getState().markAsRead(1);
    const state = useNotificationStore.getState();
    expect(state.notifications[0].is_read).toBe(true);
    expect(state.unreadCount).toBe(0);
  });

  it('mark all notifications read', async () => {
    useNotificationStore.setState({
      notifications: [{ id: 1, is_read: false }, { id: 2, is_read: false }],
      unreadCount: 2,
    });
    globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true }));

    await expect(useNotificationStore.getState().markAllAsRead()).resolves.toBe(true);
    const state = useNotificationStore.getState();
    expect(state.notifications.every((notification) => notification.is_read)).toBe(true);
    expect(state.unreadCount).toBe(0);
    expect(state.isMarkingAllAsRead).toBe(false);
    expect(state.error).toBeNull();
  });

  it('mark notification read handles network failures', async () => {
    useNotificationStore.setState({
      notifications: [{ id: 1, is_read: false }],
      unreadCount: 1,
    });
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('network')));

    await expect(useNotificationStore.getState().markAsRead(1)).resolves.toBe(false);
    const state = useNotificationStore.getState();
    expect(state.notifications[0].is_read).toBe(false);
    expect(state.unreadCount).toBe(1);
    expect(state.error).toBe('markReadFailed');
  });

  it('openNotifications clears badge and does not restore stale unreadCount', async () => {
    useNotificationStore.setState({ unreadCount: 3 });

    let fetchCallCount = 0;
    globalThis.fetch = vi.fn((url) => {
      if (url.includes('/notifications/read-all')) {
        return Promise.resolve({ ok: true });
      }
      fetchCallCount++;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          notifications: [
            { id: 1, title: 'A', is_read: false },
            { id: 2, title: 'B', is_read: false },
          ],
          total: 2,
          unread_count: 2,
        }),
      });
    });

    await useNotificationStore.getState().openNotifications();
    const state = useNotificationStore.getState();
    expect(state.unreadCount).toBe(0);
    expect(state.notifications).toHaveLength(2);
    expect(state.notifications.every((n) => n.is_read)).toBe(true);
    expect(fetchCallCount).toBe(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/notifications/read-all'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(state.error).toBeNull();
  });

  it('openNotifications records fetch failures without unhandled rejection', async () => {
    useNotificationStore.setState({
      notifications: [{ id: 99, title: 'Stale', is_read: false }],
      total: 1,
    });

    globalThis.fetch = vi.fn((url) => {
      if (url.includes('/notifications/read-all')) {
        return Promise.resolve({ ok: true });
      }
      return Promise.resolve({ ok: false });
    });

    await expect(useNotificationStore.getState().openNotifications()).resolves.toBe(false);
    const state = useNotificationStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBe('loadFailed');
    expect(state.notifications).toEqual([]);
    expect(state.total).toBe(0);
  });

  it('openNotifications keeps unread state without showing an error when auto mark-all fails', async () => {
    globalThis.fetch = vi.fn((url) => {
      if (url.includes('/notifications/read-all')) {
        return Promise.resolve({ ok: false });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          notifications: [{ id: 1, title: 'A', is_read: false }],
          total: 1,
          unread_count: 1,
        }),
      });
    });

    await expect(useNotificationStore.getState().openNotifications()).resolves.toBe(false);
    const state = useNotificationStore.getState();
    expect(state.unreadCount).toBe(1);
    expect(state.notifications[0].is_read).toBe(false);
    expect(state.error).toBeNull();
  });

  it('openNotifications skips auto mark-all when everything is already read', async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          notifications: [{ id: 1, title: 'A', is_read: true }],
          total: 1,
          unread_count: 0,
        }),
      })
    );

    await expect(useNotificationStore.getState().openNotifications()).resolves.toBe(true);
    const state = useNotificationStore.getState();
    expect(state.notifications).toEqual([{ id: 1, title: 'A', is_read: true }]);
    expect(state.unreadCount).toBe(0);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(state.error).toBeNull();
  });

  it('openNotifications restores previous unread count when fetch and mark-all both fail', async () => {
    useNotificationStore.setState({ unreadCount: 4 });

    globalThis.fetch = vi.fn(() => Promise.resolve({ ok: false }));

    await expect(useNotificationStore.getState().openNotifications()).resolves.toBe(false);
    const state = useNotificationStore.getState();
    expect(state.unreadCount).toBe(4);
    expect(state.error).toBe('loadFailed');
    expect(state.pendingUnreadCountBeforeOpen).toBe(0);
  });

  it('openNotifications does not overwrite newer unread counts after the panel closes', async () => {
    useNotificationStore.setState({ unreadCount: 4 });

    let resolveList;
    globalThis.fetch = vi.fn(() =>
      new Promise((resolve) => {
        resolveList = resolve;
      })
    );

    const openPromise = useNotificationStore.getState().openNotifications();
    useNotificationStore.getState().setPanelOpen(false);
    useNotificationStore.setState({ unreadCount: 1 });

    resolveList({ ok: false });

    await expect(openPromise).resolves.toBe(false);
    expect(useNotificationStore.getState().unreadCount).toBe(1);
  });

  it('ignores stale openNotifications results after a newer open cycle starts', async () => {
    let firstListResolve;
    let secondListResolve;
    let listCallCount = 0;

    globalThis.fetch = vi.fn((url) =>
      url.includes('/notifications/read-all')
        ? Promise.resolve({ ok: true })
        : new Promise((resolve) => {
            listCallCount += 1;
            if (listCallCount === 1) {
              firstListResolve = resolve;
            } else {
              secondListResolve = resolve;
            }
          })
    );

    const firstOpen = useNotificationStore.getState().openNotifications();
    useNotificationStore.getState().setPanelOpen(false);
    const secondOpen = useNotificationStore.getState().openNotifications();

    secondListResolve({
      ok: true,
      json: () => Promise.resolve({
        notifications: [{ id: 2, title: 'Fresh', is_read: false }],
        total: 1,
        unread_count: 1,
      }),
    });
    await expect(secondOpen).resolves.toBe(true);

    firstListResolve({
      ok: true,
      json: () => Promise.resolve({
        notifications: [{ id: 1, title: 'Old', is_read: false }],
        total: 1,
        unread_count: 1,
      }),
    });
    await expect(firstOpen).resolves.toBe(false);

    const state = useNotificationStore.getState();
    expect(state.notifications).toEqual([{ id: 2, title: 'Fresh', is_read: true }]);
    expect(state.unreadCount).toBe(0);
    expect(state.error).toBeNull();
  });

  it('openNotifications handles invalid notification payloads without rejecting', async () => {
    useNotificationStore.setState({ unreadCount: 2 });

    globalThis.fetch = vi.fn((url) => {
      if (url.includes('/notifications/read-all')) {
        return Promise.resolve({ ok: true });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.reject(new Error('bad json')),
      });
    });

    await expect(useNotificationStore.getState().openNotifications()).resolves.toBe(false);
    const state = useNotificationStore.getState();
    expect(state.unreadCount).toBe(2);
    expect(state.error).toBe('loadFailed');
  });

  it('openNotifications handles malformed notification payloads without rejecting', async () => {
    useNotificationStore.setState({ unreadCount: 2 });

    globalThis.fetch = vi.fn((url) => {
      if (url.includes('/notifications/read-all')) {
        return Promise.resolve({ ok: true });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ notifications: null, total: '2', unread_count: 1 }),
      });
    });

    await expect(useNotificationStore.getState().openNotifications()).resolves.toBe(false);
    const state = useNotificationStore.getState();
    expect(state.notifications).toEqual([]);
    expect(state.unreadCount).toBe(2);
    expect(state.error).toBe('loadFailed');
  });

  it('ignores stale unread-count responses after the panel opens', async () => {
    let resolveResponse;
    globalThis.fetch = vi.fn(() =>
      new Promise((resolve) => {
        resolveResponse = resolve;
      })
    );

    const pendingFetch = useNotificationStore.getState().fetchUnreadCount();
    useNotificationStore.getState().prepareToOpenPanel();

    resolveResponse({
      ok: true,
      json: () => Promise.resolve({ count: 4 }),
    });

    await pendingFetch;
    const state = useNotificationStore.getState();
    expect(state.unreadCount).toBe(0);
    expect(state.isPanelOpen).toBe(true);
  });

  it('ignores unread-count responses that started before the panel closed', async () => {
    useNotificationStore.setState({
      isPanelOpen: true,
      unreadCount: 0,
      unreadCountRequestVersion: 1,
    });

    let resolveResponse;
    globalThis.fetch = vi.fn(() =>
      new Promise((resolve) => {
        resolveResponse = resolve;
      })
    );

    const pendingFetch = useNotificationStore.getState().fetchUnreadCount();
    useNotificationStore.getState().setPanelOpen(false);

    resolveResponse({
      ok: true,
      json: () => Promise.resolve({ count: 4 }),
    });

    await pendingFetch;
    const state = useNotificationStore.getState();
    expect(state.unreadCount).toBe(0);
    expect(state.isPanelOpen).toBe(false);
    expect(state.unreadCountRequestVersion).toBe(2);
  });

  it('unread count updates', async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ count: 5 }) })
    );
    await useNotificationStore.getState().fetchUnreadCount();
    expect(useNotificationStore.getState().unreadCount).toBe(5);
  });

  it('ignores malformed unread-count payloads', async () => {
    useNotificationStore.setState({ unreadCount: 3 });
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ count: null }) })
    );

    await useNotificationStore.getState().fetchUnreadCount();
    expect(useNotificationStore.getState().unreadCount).toBe(3);
  });
});
