import { create } from 'zustand';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const useAuthStore = create((set, get) => ({
  user: null,
  accessToken: localStorage.getItem('accessToken') || null,
  isLoading: true,
  isAuthenticated: false,
  error: null,

  initialize: async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      set({ isLoading: false, isAuthenticated: false });
      return;
    }

    try {
      // Check if token is expired by decoding payload
      const payload = JSON.parse(atob(token.split('.')[1]));
      const isExpired = payload.exp * 1000 < Date.now();

      if (isExpired) {
        // Try refresh
        await get().refreshAccessToken();
        return;
      }

      set({ accessToken: token });
      await get().fetchUser();
    } catch {
      set({ isLoading: false, isAuthenticated: false, accessToken: null });
      localStorage.removeItem('accessToken');
    }
  },

  handleCallback: async (token) => {
    localStorage.setItem('accessToken', token);
    set({ accessToken: token, isLoading: true });
    await get().fetchUser();
  },

  fetchUser: async () => {
    const { accessToken } = get();
    if (!accessToken) {
      set({ isLoading: false, isAuthenticated: false });
      return;
    }

    try {
      const resp = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!resp.ok) throw new Error('Failed to fetch user');
      const user = await resp.json();
      set({ user, isAuthenticated: true, isLoading: false, error: null });
    } catch (err) {
      set({ isLoading: false, isAuthenticated: false, error: err.message });
      localStorage.removeItem('accessToken');
    }
  },

  refreshAccessToken: async () => {
    try {
      const resp = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!resp.ok) throw new Error('Refresh failed');
      const data = await resp.json();
      localStorage.setItem('accessToken', data.access_token);
      set({ accessToken: data.access_token });
      await get().fetchUser();
    } catch {
      set({ isLoading: false, isAuthenticated: false, accessToken: null, user: null });
      localStorage.removeItem('accessToken');
    }
  },

  logout: async () => {
    try {
      const { accessToken } = get();
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
    } catch {
      // Ignore errors during logout
    }
    localStorage.removeItem('accessToken');
    set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false, error: null });
  },

  getToken: () => get().accessToken,
}));

export default useAuthStore;
