import useAuthStore from '../stores/useAuthStore';
import { addRequestInterceptor, addResponseInterceptor } from './httpClient';

/**
 * Wire up auth interceptors on httpClient so that any store using
 * httpClient.get/post/… automatically gets an Authorization header
 * and 401-refresh behaviour identical to authFetch.
 *
 * Call once at app init (e.g. in main.jsx).
 */
export function setupAuthInterceptors() {
  // Inject Authorization header into every outgoing request
  addRequestInterceptor(async (config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers = { ...config.headers, Authorization: `Bearer ${token}` };
    }
    return config;
  });

  // On 401 responses, refresh the token and retry the failed request
  addResponseInterceptor(
    undefined,
    async (error) => {
      if (error.status === 401 && error._requestUrl && !error._requestConfig?._authRetried) {
        const ok = await useAuthStore.getState().refreshAccessToken();
        if (ok) {
          const token = useAuthStore.getState().accessToken;
          if (token) {
            // Exclude stale AbortSignal from the original request
            const { signal, ...baseConfig } = error._requestConfig;
            const retryConfig = {
              ...baseConfig,
              _authRetried: true,
              headers: { ...baseConfig.headers, Authorization: `Bearer ${token}` },
            };
            const response = await fetch(error._requestUrl, retryConfig);
            const contentType = response.headers.get('content-type') || '';
            const data = contentType.includes('application/json')
              ? await response.json()
              : await response.text();
            if (response.ok) return data;
          }
        }
        useAuthStore.getState().logout?.();
      }
      return undefined; // let default error handling continue
    },
  );
}
