import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useNotificationStore from '../../stores/useNotificationStore';
import NotificationPanel from './NotificationPanel';

export default function NotificationBell({ position = 'bottom-right', isOpen: controlledOpen, onToggle, renderPanel = true }) {
  const { t } = useTranslation();
  const { unreadCount, fetchUnreadCount } = useNotificationStore();
  const [internalOpen, setInternalOpen] = useState(false);

  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const handleToggle = onToggle || (() => setInternalOpen((prev) => !prev));

  useEffect(() => {
    if (isOpen) return;
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount, isOpen]);

  return (
    <div className="relative">
      <button
        onClick={() => {
          handleToggle();
          if (!isOpen) {
            useNotificationStore.setState({ unreadCount: 0 });
          }
        }}
        className="relative p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        aria-label={t('notifications.title')}
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {renderPanel && isOpen && <NotificationPanel onClose={() => (onToggle ? onToggle() : setInternalOpen(false))} position={position} />}
    </div>
  );
}
