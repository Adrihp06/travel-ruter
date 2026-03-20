import useAuthStore from '../stores/useAuthStore';

let refreshPromise = null;

/**
 * Fetch wrapper that automatically includes the JWT auth token.
 * Handles 401 responses by attempting a token refresh and retrying once.
 * Drop-in replacement for fetch() in all stores.
 */
const authFetch = async (url, options = {}) => {
  const token = useAuthStore.getState().accessToken;
  const headers = { ...(options.headers || {}) };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, { ...options, headers });

  // Handle 401 — try token refresh once
  if (response.status === 401 && token && !options._retried) {
    // Deduplicate: reuse an in-flight refresh promise if one exists
    if (!refreshPromise) {
      refreshPromise = useAuthStore.getState().refreshAccessToken?.()
        .finally(() => { refreshPromise = null; });
    }

    try {
      const refreshed = await refreshPromise;
      if (refreshed) {
        const newToken = useAuthStore.getState().accessToken;
        if (newToken && newToken !== token) {
          const retryHeaders = { ...(options.headers || {}), 'Authorization': `Bearer ${newToken}` };
          if (options.body && typeof options.body === 'string' && !retryHeaders['Content-Type']) {
            retryHeaders['Content-Type'] = 'application/json';
          }
          return fetch(url, { ...options, headers: retryHeaders, _retried: true });
        }
      }
    } catch {
      // Refresh failed — fall through, return original 401
    }
    // Refresh failed or returned no new token — logout
    useAuthStore.getState().logout?.();
  }

  return response;
};

export default authFetch;
