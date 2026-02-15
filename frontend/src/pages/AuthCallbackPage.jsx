import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useAuthStore from '../stores/useAuthStore';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const handleCallback = useAuthStore((s) => s.handleCallback);

  useEffect(() => {
    const processCallback = async () => {
      const token = searchParams.get('access_token');
      if (token) {
        await handleCallback(token);
        navigate('/trips', { replace: true });
      } else {
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
