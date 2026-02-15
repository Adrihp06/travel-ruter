import useAuthStore from '../stores/useAuthStore';

/**
 * Fetch wrapper that automatically includes the JWT auth token.
 * Drop-in replacement for fetch() in all stores.
 */
const authFetch = async (url, options = {}) => {
  const token = useAuthStore.getState().token;
  const headers = { ...(options.headers || {}) };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  return fetch(url, { ...options, headers });
};

export default authFetch;
