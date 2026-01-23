import React from 'react';
import { Calendar } from 'lucide-react';

const CalendarViewToggle = ({ onClick, isActive = false }) => {
  return (
    <button
      onClick={onClick}
      className={`
        p-2.5 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 border flex items-center justify-center group relative
        ${isActive
          ? 'bg-blue-600 dark:bg-blue-600 border-blue-700 dark:border-blue-500'
          : 'bg-white dark:bg-gray-700 border-gray-100 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
        }
      `}
      aria-label="Toggle calendar view"
    >
      <Calendar
        className={`
          w-5 h-5 transition-colors
          ${isActive
            ? 'text-white'
            : 'text-gray-600 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400'
          }
        `}
      />
    </button>
  );
};

export default CalendarViewToggle;
