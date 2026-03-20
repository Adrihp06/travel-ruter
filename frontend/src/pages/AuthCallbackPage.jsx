import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../stores/useAuthStore';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const handleCallback = useAuthStore((s) => s.handleCallback);

  useEffect(() => {
    const processCallback = async () => {
      // Read token from URL fragment (not query param) to prevent server-side logging
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const token = params.get('access_token');
      if (token) {
        window.history.replaceState(null, '', window.location.pathname);
        await handleCallback(token);
        navigate('/trips', { replace: true });
      } else {
        navigate('/login', { replace: true });
      }
    };
    processCallback();
  }, [handleCallback, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );
}
