import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useAuthStore from '../stores/useAuthStore';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const handleCallback = useAuthStore((s) => s.handleCallback);

  useEffect(() => {
    const processCallback = async () => {
      // Support both flows: token in URL (legacy) and HttpOnly cookie (new)
      const token = searchParams.get('access_token');
      if (token) {
        await handleCallback(token);
        navigate('/trips', { replace: true });
        return;
      }

      // No token in URL — the backend set an HttpOnly cookie instead.
      // Verify authentication via /auth/me (cookie sent automatically).
      try {
        const response = await fetch('/api/v1/auth/me', { credentials: 'include' });
        if (response.ok) {
          const user = await response.json();
          useAuthStore.setState({ user, isAuthenticated: true, isLoading: false, error: null });
          navigate('/trips', { replace: true });
        } else {
          navigate('/login', { replace: true });
        }
      } catch {
        navigate('/login', { replace: true });
      }
    };
    processCallback();
  }, [searchParams, handleCallback, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );
}
