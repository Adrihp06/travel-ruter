import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useAuthStore from '../../stores/useAuthStore';
import CommentInput from './CommentInput';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export default function CommentThread({ tripId, entityType, entityId }) {
  const { t } = useTranslation();
  const getToken = useAuthStore((s) => s.getToken);
  const user = useAuthStore((s) => s.user);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchComments = async () => {
    try {
      const token = getToken();
      const resp = await fetch(
        `${API_BASE}/trips/${tripId}/comments?entity_type=${entityType}&entity_id=${entityId}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (resp.ok) setComments(await resp.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [tripId, entityType, entityId]);

  const handleCommentAdded = () => fetchComments();

  if (loading) return <div className="animate-pulse h-16 bg-gray-100 dark:bg-gray-800 rounded" />;

  const renderComment = (comment, depth = 0) => (
    <div key={comment.id} className={`${depth > 0 ? 'ml-6 border-l-2 border-gray-200 dark:border-gray-700 pl-3' : ''}`}>
      <div className="flex items-start gap-2 py-2">
        <div className="h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs flex-shrink-0">
          {(comment.user_name || '?')[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {comment.user_name || 'User'}
            </span>
            <span className="text-xs text-gray-400">
              {new Date(comment.created_at).toLocaleString()}
            </span>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{comment.content}</p>
        </div>
      </div>
      {comment.replies?.map((reply) => renderComment(reply, depth + 1))}
    </div>
  );

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {t('comments.title')} ({comments.length})
      </h3>
      {comments.length === 0 ? (
        <p className="text-sm text-gray-500">{t('comments.noComments')}</p>
      ) : (
        comments.map((c) => renderComment(c))
      )}
      {user && (
        <CommentInput
          tripId={tripId}
          entityType={entityType}
          entityId={entityId}
          onCommentAdded={handleCommentAdded}
        />
      )}
    </div>
  );
}
