import React from 'react';
import { NavLink } from 'react-router-dom';
import { Map, Bot, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import GearIcon from '@/components/icons/gear-icon';
import XIcon from '@/components/icons/x-icon';
import useAuthStore from '../../stores/useAuthStore';
import NotificationBell from '../Notifications/NotificationBell';

const Sidebar = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { isAuthenticated, user, logout } = useAuthStore();

  const navItems = [
    { name: t('nav.trips'), path: '/trips', icon: Map },
    { name: t('nav.settings'), path: '/settings', icon: GearIcon },
    { name: t('nav.aiSettings'), path: '/ai-settings', icon: Bot },
  ];

  const handleLogout = async () => {
    await logout();
    onClose();
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <div className={`
        fixed top-0 left-0 bottom-0 z-50 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transform transition-all duration-200 ease-in-out flex flex-col
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:static md:inset-auto md:block
      `}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200 dark:border-gray-700">
          <span className="text-xl font-bold text-[#D97706] dark:text-amber-400">{t('nav.travelRuter')}</span>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 md:hidden"
          >
            <XIcon className="w-6 h-6 text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              onClick={() => onClose()} // Close sidebar on mobile when link clicked
              className={({ isActive }) => `
                flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors
                ${isActive
                  ? 'bg-amber-50 dark:bg-amber-900/20 text-[#D97706] dark:text-amber-300'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'}
              `}
            >
              <item.icon className="w-5 h-5 mr-3" />
              {item.name}
            </NavLink>
          ))}
        </nav>

        {/* User Profile Section - only when authenticated */}
        {isAuthenticated && user && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <div className="h-8 w-8 rounded-full bg-[#D97706] flex items-center justify-center text-white text-sm font-medium">
                  {(user.display_name || user.email || '?')[0].toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {user.display_name || user.email}
                </p>
              </div>
              <NotificationBell />
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors"
                aria-label={t('auth.logout')}
                title={t('auth.logout')}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Sidebar;
