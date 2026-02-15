import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import useCollaborationStore from '../../stores/useCollaborationStore';

export default function TripMemberList({ tripId }) {
  const { t } = useTranslation();
  const { members, isLoading, fetchMembers } = useCollaborationStore();

  useEffect(() => {
    if (tripId) fetchMembers(tripId);
  }, [tripId, fetchMembers]);

  if (isLoading) {
    return <div className="animate-pulse h-20 bg-gray-100 dark:bg-gray-800 rounded" />;
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {t('collaboration.members')}
      </h3>
      <div className="space-y-1">
        {members.map((member) => (
          <div
            key={member.id}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800"
          >
            {member.user_avatar ? (
              <img
                src={member.user_avatar}
                alt={member.user_name || ''}
                className="h-6 w-6 rounded-full"
              />
            ) : (
              <div className="h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs">
                {(member.user_name || member.user_email || '?')[0].toUpperCase()}
              </div>
            )}
            <span className="text-sm text-gray-900 dark:text-gray-100 flex-1">
              {member.user_name || member.user_email}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
              {t(`collaboration.${member.role}`)}
            </span>
            {member.status === 'pending' && (
              <span className="text-xs text-yellow-600 dark:text-yellow-400">
                {t('collaboration.pending')}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
