import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useAuthStore from '../../stores/useAuthStore';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export default function VoteButtons({ poiId, likes = 0, vetoes = 0, currentUserVote = null }) {
  const { t } = useTranslation();
  const getToken = useAuthStore((s) => s.getToken);
  const [localLikes, setLocalLikes] = useState(likes);
  const [localVetoes, setLocalVetoes] = useState(vetoes);
  const [userVote, setUserVote] = useState(currentUserVote);

  const handleVote = async (voteType) => {
    const token = getToken();
    if (!token) return;

    try {
      const resp = await fetch(`${API_BASE}/pois/${poiId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ vote_type: voteType }),
      });
      if (resp.ok) {
        const data = await resp.json();
        setLocalLikes(data.likes ?? localLikes);
        setLocalVetoes(data.vetoes ?? localVetoes);
        setUserVote(data.current_user_vote);
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => handleVote('like')}
        className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
          userVote === 'like'
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
        }`}
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
        </svg>
        {localLikes > 0 && localLikes}
        {t('votes.like')}
      </button>
      <button
        onClick={() => handleVote('veto')}
        className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
          userVote === 'veto'
            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
        }`}
      >
        <svg className="h-3.5 w-3.5 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
        </svg>
        {localVetoes > 0 && localVetoes}
        {t('votes.veto')}
      </button>
    </div>
  );
}
