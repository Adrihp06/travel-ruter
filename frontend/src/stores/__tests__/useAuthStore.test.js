import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import useAuthStore from '../useAuthStore';

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isLoading: true,
      isAuthenticated: false,
      error: null,
    });
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initial state is unauthenticated', () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
  });

  it('handleCallback stores token and sets authenticated', () => {
    useAuthStore.getState().handleCallback('test-token');
    const state = useAuthStore.getState();
    expect(state.accessToken).toBe('test-token');
    expect(state.isAuthenticated).toBe(true);
    expect(localStorage.getItem('accessToken')).toBe('test-token');
  });

  it('logout clears state and localStorage', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: true }));
    useAuthStore.setState({ user: { id: 1 }, accessToken: 'token', isAuthenticated: true });
    localStorage.setItem('accessToken', 'token');

    await useAuthStore.getState().logout();
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(localStorage.getItem('accessToken')).toBeNull();
  });

  it('initialize with no token stays unauthenticated', async () => {
    await useAuthStore.getState().initialize();
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
  });

  it('getToken returns current access token', () => {
    useAuthStore.setState({ accessToken: 'my-token' });
    expect(useAuthStore.getState().getToken()).toBe('my-token');
  });
});
