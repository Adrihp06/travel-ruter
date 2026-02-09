/**
 * Centralized HTTP client with unified error handling, retry logic, and request cancellation
 */

const DEFAULT_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000; // 1 second

// Active request controllers for cancellation
const activeRequests = new Map();

// Request interceptors
const requestInterceptors = [];
const responseInterceptors = [];

/**
 * Add a request interceptor
 * @param {Function} interceptor - Function that receives and returns the config
 */
export const addRequestInterceptor = (interceptor) => {
  requestInterceptors.push(interceptor);
  return () => {
    const index = requestInterceptors.indexOf(interceptor);
    if (index > -1) requestInterceptors.splice(index, 1);
  };
};

/**
 * Add a response interceptor
 * @param {Function} onFulfilled - Function for successful responses
 * @param {Function} onRejected - Function for errors
 */
export const addResponseInterceptor = (onFulfilled, onRejected) => {
  const interceptor = { onFulfilled, onRejected };
  responseInterceptors.push(interceptor);
  return () => {
    const index = responseInterceptors.indexOf(interceptor);
    if (index > -1) responseInterceptors.splice(index, 1);
  };
};

/**
 * Calculate exponential backoff delay
 */
const getRetryDelay = (attempt) => {
  return RETRY_DELAY_BASE * Math.pow(2, attempt) + Math.random() * 1000;
};

/**
 * Check if error is retryable
 */
const isRetryableError = (error, status) => {
  // Network errors
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return true;
  }
  // Server errors (5xx) or rate limiting (429)
  if (status >= 500 || status === 429) {
    return true;
  }
  return false;
};

/**
 * Sleep helper for retry delays
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Create an AbortController with timeout
 */
const createAbortController = (timeout, requestId) => {
  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort(new Error('Request timeout'));
  }, timeout);

  // Store for potential cancellation
  if (requestId) {
    activeRequests.set(requestId, { controller, timeoutId });
  }

  return { controller, timeoutId };
};

/**
 * Cancel a request by ID
 */
export const cancelRequest = (requestId) => {
  const request = activeRequests.get(requestId);
  if (request) {
    clearTimeout(request.timeoutId);
    request.controller.abort(new Error('Request cancelled'));
    activeRequests.delete(requestId);
    return true;
  }
  return false;
};

/**
 * Cancel all active requests
 */
export const cancelAllRequests = () => {
  activeRequests.forEach(({ controller, timeoutId }) => {
    clearTimeout(timeoutId);
    controller.abort(new Error('All requests cancelled'));
  });
  activeRequests.clear();
};

/**
 * HTTP Error class for structured error handling
 */
export class HttpError extends Error {
  constructor(message, status, data = null, originalError = null) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.data = data;
    this.originalError = originalError;
  }

  get isNetworkError() {
    return this.status === 0;
  }

  get isClientError() {
    return this.status >= 400 && this.status < 500;
  }

  get isServerError() {
    return this.status >= 500;
  }

  get isTimeout() {
    return this.message === 'Request timeout';
  }

  get isCancelled() {
    return this.message === 'Request cancelled' || this.message === 'All requests cancelled';
  }
}

/**
 * Parse response based on content type
 */
const parseResponse = async (response) => {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return response.json();
  }
  if (contentType.includes('text/')) {
    return response.text();
  }
  if (contentType.includes('application/octet-stream') || contentType.includes('image/')) {
    return response.blob();
  }

  // Try JSON first, fall back to text
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

/**
 * Main request function
 */
const request = async (url, options = {}) => {
  const {
    method = 'GET',
    headers = {},
    body,
    timeout = DEFAULT_TIMEOUT,
    retries = MAX_RETRIES,
    requestId = null,
    skipRetry = false,
    ...fetchOptions
  } = options;

  // Build config
  let config = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    ...fetchOptions,
  };

  // Handle body
  if (body) {
    if (body instanceof FormData) {
      delete config.headers['Content-Type']; // Let browser set it
      config.body = body;
    } else if (typeof body === 'object') {
      config.body = JSON.stringify(body);
    } else {
      config.body = body;
    }
  }

  // Run request interceptors
  for (const interceptor of requestInterceptors) {
    config = await interceptor(config);
  }

  // Setup abort controller
  const { controller, timeoutId } = createAbortController(timeout, requestId);
  config.signal = controller.signal;

  let lastError;
  let attempt = 0;

  while (attempt <= (skipRetry ? 0 : retries)) {
    try {
      const response = await fetch(url, config);

      // Clean up
      clearTimeout(timeoutId);
      if (requestId) activeRequests.delete(requestId);

      // Parse response
      const data = await parseResponse(response);

      // Handle non-2xx responses
      if (!response.ok) {
        const error = new HttpError(
          data?.message || data?.error || `HTTP ${response.status}`,
          response.status,
          data
        );

        // Run error interceptors
        for (const { onRejected } of responseInterceptors) {
          if (onRejected) {
            try {
              const handled = await onRejected(error);
              if (handled !== undefined) return handled;
            } catch (e) {
              throw e;
            }
          }
        }

        throw error;
      }

      // Run success interceptors
      let result = { data, status: response.status, headers: response.headers };
      for (const { onFulfilled } of responseInterceptors) {
        if (onFulfilled) {
          result = await onFulfilled(result);
        }
      }

      return result.data !== undefined ? result.data : result;
    } catch (error) {
      // Clean up on error
      clearTimeout(timeoutId);
      if (requestId) activeRequests.delete(requestId);

      // Handle abort errors
      if (error.name === 'AbortError') {
        throw new HttpError(
          controller.signal.reason?.message || 'Request aborted',
          0,
          null,
          error
        );
      }

      // Check if retryable
      const status = error instanceof HttpError ? error.status : 0;
      if (!skipRetry && attempt < retries && isRetryableError(error, status)) {
        lastError = error;
        attempt++;
        await sleep(getRetryDelay(attempt));
        continue;
      }

      // Wrap in HttpError if not already
      if (!(error instanceof HttpError)) {
        throw new HttpError(
          error.message || 'Network error',
          0,
          null,
          error
        );
      }

      throw error;
    }
  }

  throw lastError;
};

// Convenience methods
const httpClient = {
  get: (url, options = {}) => request(url, { ...options, method: 'GET' }),
  post: (url, body, options = {}) => request(url, { ...options, method: 'POST', body }),
  put: (url, body, options = {}) => request(url, { ...options, method: 'PUT', body }),
  patch: (url, body, options = {}) => request(url, { ...options, method: 'PATCH', body }),
  delete: (url, options = {}) => request(url, { ...options, method: 'DELETE' }),

  // Utilities
  request,
  cancelRequest,
  cancelAllRequests,
  addRequestInterceptor,
  addResponseInterceptor,
  HttpError,
};

export default httpClient;
