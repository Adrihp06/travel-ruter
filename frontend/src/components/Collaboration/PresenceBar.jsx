import { useTranslation } from 'react-i18next';
import useCollaborationStore from '../../stores/useCollaborationStore';

export default function PresenceBar() {
  const { t } = useTranslation();
  const { members, onlineUsers } = useCollaborationStore();

  const onlineMembers = members.filter((m) => onlineUsers.includes(m.user_id));

  if (onlineMembers.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 rounded-lg">
      <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
      <span className="text-xs text-green-700 dark:text-green-400">
        {onlineMembers.length} {t('collaboration.online')}
      </span>
      <div className="flex -space-x-1 ml-1">
        {onlineMembers.slice(0, 5).map((m) => (
          <div
            key={m.user_id}
            title={m.user_name || m.user_email}
            className="h-5 w-5 rounded-full bg-blue-500 border-2 border-white dark:border-gray-800 flex items-center justify-center text-white text-[10px]"
          >
            {(m.user_name || '?')[0].toUpperCase()}
          </div>
        ))}
      </div>
    </div>
  );
}
