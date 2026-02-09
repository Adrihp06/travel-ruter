import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import httpClient, {
  HttpError,
  cancelRequest,
  cancelAllRequests,
  addRequestInterceptor,
  addResponseInterceptor,
} from '../httpClient';

describe('httpClient', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    cancelAllRequests();
  });

  describe('Basic HTTP Methods', () => {
    it('should make GET request', async () => {
      const mockData = { id: 1, name: 'Test' };
      global.fetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockData),
      });

      const result = await httpClient.get('https://api.example.com/test');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          method: 'GET',
        })
      );
      expect(result).toEqual(mockData);
    });

    it('should make POST request with body', async () => {
      const mockData = { id: 1 };
      const body = { name: 'New Item' };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockData),
      });

      const result = await httpClient.post('https://api.example.com/test', body);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(body),
        })
      );
      expect(result).toEqual(mockData);
    });

    it('should make PUT request', async () => {
      const mockData = { id: 1, name: 'Updated' };
      global.fetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockData),
      });

      await httpClient.put('https://api.example.com/test/1', { name: 'Updated' });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test/1',
        expect.objectContaining({
          method: 'PUT',
        })
      );
    });

    it('should make PATCH request', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({}),
      });

      await httpClient.patch('https://api.example.com/test/1', { status: 'active' });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test/1',
        expect.objectContaining({
          method: 'PATCH',
        })
      );
    });

    it('should make DELETE request', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({}),
      });

      await httpClient.delete('https://api.example.com/test/1');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test/1',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should throw HttpError on non-2xx response', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ message: 'Not found' }),
      });

      try {
        await httpClient.get('https://api.example.com/missing');
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpError);
        expect(error.status).toBe(404);
        expect(error.isClientError).toBe(true);
      }
    });

    it('should handle 500 server error', async () => {
      global.fetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({ error: 'Server error' }),
        })
        // Retries (3 default retries)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({ error: 'Server error' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({ error: 'Server error' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({ error: 'Server error' }),
        });

      try {
        await httpClient.get('https://api.example.com/error', { skipRetry: true });
      } catch (error) {
        expect(error).toBeInstanceOf(HttpError);
        expect(error.status).toBe(500);
        expect(error.isServerError).toBe(true);
      }
    });
  });

  describe('HttpError', () => {
    it('should have correct properties', () => {
      const error = new HttpError('Not found', 404, { detail: 'Resource not found' });

      expect(error.message).toBe('Not found');
      expect(error.status).toBe(404);
      expect(error.data).toEqual({ detail: 'Resource not found' });
      expect(error.isClientError).toBe(true);
      expect(error.isServerError).toBe(false);
      expect(error.isNetworkError).toBe(false);
    });

    it('should identify network errors', () => {
      const error = new HttpError('Network error', 0);
      expect(error.isNetworkError).toBe(true);
    });

    it('should identify server errors', () => {
      const error = new HttpError('Server error', 503);
      expect(error.isServerError).toBe(true);
    });
  });

  describe('Request Cancellation', () => {
    it('should cancel a specific request', async () => {
      let fetchCalled = false;

      global.fetch.mockImplementation(async (url, options) => {
        fetchCalled = true;
        // Check if already aborted
        if (options.signal?.aborted) {
          const error = new Error('Aborted');
          error.name = 'AbortError';
          throw error;
        }
        // Simulate slow request
        await new Promise((resolve, reject) => {
          options.signal?.addEventListener('abort', () => reject(new Error('Aborted')));
          setTimeout(resolve, 1000);
        });
        return {
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({}),
        };
      });

      const requestPromise = httpClient.get('https://api.example.com/slow', {
        requestId: 'test-request',
        skipRetry: true,
      });

      // Cancel immediately
      cancelRequest('test-request');

      await expect(requestPromise).rejects.toThrow();
    });
  });

  describe('Interceptors', () => {
    it('should apply request interceptor', async () => {
      const interceptor = vi.fn((config) => ({
        ...config,
        headers: {
          ...config.headers,
          'X-Custom-Header': 'test-value',
        },
      }));

      const removeInterceptor = addRequestInterceptor(interceptor);

      global.fetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({}),
      });

      await httpClient.get('https://api.example.com/test');

      expect(interceptor).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Custom-Header': 'test-value',
          }),
        })
      );

      // Clean up
      removeInterceptor();
    });

    it('should apply response interceptor on success', async () => {
      const onFulfilled = vi.fn((response) => ({
        ...response,
        data: { ...response.data, intercepted: true },
      }));

      const removeInterceptor = addResponseInterceptor(onFulfilled, null);

      global.fetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ id: 1 }),
      });

      const result = await httpClient.get('https://api.example.com/test');

      expect(onFulfilled).toHaveBeenCalled();
      expect(result.intercepted).toBe(true);

      // Clean up
      removeInterceptor();
    });
  });

  describe('Content Types', () => {
    it('should handle text response', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: () => Promise.resolve('Hello, World!'),
      });

      const result = await httpClient.get('https://api.example.com/text');
      expect(result).toBe('Hello, World!');
    });

    it('should handle FormData body', async () => {
      const formData = new FormData();
      formData.append('file', new Blob(['test']), 'test.txt');

      global.fetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ success: true }),
      });

      await httpClient.post('https://api.example.com/upload', formData);

      // Should not have Content-Type header (let browser set it)
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/upload',
        expect.objectContaining({
          body: formData,
        })
      );
    });
  });
});
