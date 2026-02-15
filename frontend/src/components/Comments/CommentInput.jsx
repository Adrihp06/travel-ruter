import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useAuthStore from '../../stores/useAuthStore';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export default function CommentInput({ tripId, entityType, entityId, parentId = null, onCommentAdded }) {
  const { t } = useTranslation();
  const getToken = useAuthStore((s) => s.getToken);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;

    setLoading(true);
    try {
      const token = getToken();
      const resp = await fetch(`${API_BASE}/trips/${tripId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          entity_type: entityType,
          entity_id: entityId,
          content: content.trim(),
          parent_id: parentId,
        }),
      });
      if (resp.ok) {
        setContent('');
        onCommentAdded?.();
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 mt-2">
      <input
        type="text"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={t('comments.addComment')}
        className="flex-1 px-3 py-1.5 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
      />
      <button
        type="submit"
        disabled={loading || !content.trim()}
        className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? '...' : t('comments.title', 'Comment')}
      </button>
    </form>
  );
}
