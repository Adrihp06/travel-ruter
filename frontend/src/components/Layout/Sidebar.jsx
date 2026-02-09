import React from 'react';
import { NavLink } from 'react-router-dom';
import { Map, Bot } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import GearIcon from '@/components/icons/gear-icon';
import XIcon from '@/components/icons/x-icon';

const Sidebar = ({ isOpen, onClose }) => {
  const { t } = useTranslation();

  const navItems = [
    { name: t('nav.trips'), path: '/trips', icon: Map },
    { name: t('nav.settings'), path: '/settings', icon: GearIcon },
    { name: t('nav.aiSettings'), path: '/ai-settings', icon: Bot },
  ];

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
        fixed top-0 left-0 bottom-0 z-50 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transform transition-all duration-200 ease-in-out
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

        <nav className="p-4 space-y-1">
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
      </div>
    </>
  );
};

export default Sidebar;
