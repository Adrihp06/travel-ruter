import useAuthStore from '../stores/useAuthStore';

export function setupAuthInterceptors(httpClient) {
  // Request interceptor: inject auth header
  const originalFetch = httpClient.fetch || window.fetch;

  httpClient.authenticatedFetch = async (url, options = {}) => {
    const token = useAuthStore.getState().getToken();
    const headers = {
      ...options.headers,
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let response = await originalFetch(url, { ...options, headers });

    // If 401, try refresh and retry once
    if (response.status === 401 && token) {
      await useAuthStore.getState().refreshAccessToken();
      const newToken = useAuthStore.getState().getToken();
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
        response = await originalFetch(url, { ...options, headers });
      }
      if (response.status === 401) {
        useAuthStore.getState().logout();
      }
    }

    return response;
  };

  return httpClient;
}
