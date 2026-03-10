import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import useNotificationStore from '../../stores/useNotificationStore';

function timeAgo(dateStr) {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = Math.max(0, now - date);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function ActorAvatar({ name, avatarUrl, size = 'sm' }) {
  const sizeClass = size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-xs';
  if (avatarUrl) {
    return <img src={avatarUrl} alt="" className={`${sizeClass} rounded-full object-cover flex-shrink-0`} />;
  }
  return (
    <div className={`${sizeClass} rounded-full bg-[#D97706] flex items-center justify-center text-white font-medium flex-shrink-0`}>
      {(name || '?')[0].toUpperCase()}
    </div>
  );
}

export default function NotificationPanel({ onClose: _onClose, position = 'bottom-right', variant = 'dropdown' }) {
  const { t } = useTranslation();
  const { notifications, isLoading, isMarkingAllAsRead, error, openNotifications, markAsRead, markAllAsRead } =
    useNotificationStore();

  useEffect(() => {
    void openNotifications();
  }, [openNotifications]);

  const isInline = variant === 'inline';

  const containerClass = isInline
    ? 'w-full bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700'
    : `absolute w-80 max-w-[calc(100vw-1rem)] bg-white dark:bg-gray-800 rounded-xl shadow-xl border dark:border-gray-700 z-50 ${
        position === 'top-left' ? 'left-0 bottom-full mb-2' : 'right-0 mt-2'
      }`;

  return (
    <div className={containerClass}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-700">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {t('notifications.title')}
        </h3>
        <button
          onClick={markAllAsRead}
          disabled={isMarkingAllAsRead || isLoading}
          className="text-[11px] text-[#D97706] hover:text-[#B45309] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isMarkingAllAsRead ? t('common.loading', 'Loading...') : t('notifications.markAllRead')}
        </button>
      </div>
      <div className={isInline ? 'max-h-60 overflow-y-auto' : 'max-h-80 overflow-y-auto'}>
        {error && (
          <div className="px-4 py-2 text-xs text-red-600 dark:text-red-400 border-b border-red-100 dark:border-red-900/40">
            {t(`notifications.${error}`)}
          </div>
        )}
        {isLoading ? (
          <div className="p-4 text-center text-gray-500 text-sm">{t('common.loading', 'Loading...')}</div>
        ) : notifications.length === 0 ? (
          <div className="p-4 text-center text-gray-400 dark:text-gray-500 text-sm">
            {t('notifications.noNotifications')}
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => !n.is_read && markAsRead(n.id)}
              className={`px-4 py-3 border-b border-gray-50 dark:border-gray-700/50 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                !n.is_read ? 'bg-amber-50/60 dark:bg-amber-900/10' : ''
              }`}
            >
              <div className="flex items-start gap-2.5">
                <ActorAvatar
                  name={n.data?.actor_name}
                  avatarUrl={n.data?.actor_avatar_url}
                />
                <div className="flex-1 min-w-0">
                  {n.data?.actor_name && (
                    <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                      {n.data.actor_name}
                    </p>
                  )}
                  <p className="text-sm font-medium text-gray-900 dark:text-white leading-snug">
                    {n.title}
                  </p>
                  {n.message && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                      {n.message}
                    </p>
                  )}
                  {n.created_at && (
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                      {timeAgo(n.created_at)}
                    </p>
                  )}
                </div>
                {!n.is_read && (
                  <span className="h-2 w-2 rounded-full bg-[#D97706] flex-shrink-0 mt-1.5" />
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
