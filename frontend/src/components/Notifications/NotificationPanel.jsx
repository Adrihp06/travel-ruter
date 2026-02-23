import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import useNotificationStore from '../../stores/useNotificationStore';

export default function NotificationPanel({ onClose }) {
  const { t } = useTranslation();
  const { notifications, isLoading, fetchNotifications, markAsRead, markAllAsRead } =
    useNotificationStore();

  useEffect(() => {
    (async () => {
      await fetchNotifications();
      markAllAsRead();
    })();
  }, [fetchNotifications, markAllAsRead]);

  return (
    <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-1rem)] bg-white dark:bg-gray-800 rounded-xl shadow-xl border dark:border-gray-700 z-50">
      <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700">
        <h3 className="font-medium text-gray-900 dark:text-white">{t('notifications.title')}</h3>
        <button
          onClick={markAllAsRead}
          className="text-xs text-blue-600 hover:text-blue-700"
        >
          {t('notifications.markAllRead')}
        </button>
      </div>
      <div className="max-h-80 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-gray-500">{t('common.loading', 'Loading...')}</div>
        ) : notifications.length === 0 ? (
          <div className="p-4 text-center text-gray-500">{t('notifications.noNotifications')}</div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => !n.is_read && markAsRead(n.id)}
              className={`px-4 py-3 border-b dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${
                !n.is_read ? 'bg-blue-50 dark:bg-blue-900/20' : ''
              }`}
            >
              <p className="text-sm font-medium text-gray-900 dark:text-white">{n.title}</p>
              {n.message && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{n.message}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
