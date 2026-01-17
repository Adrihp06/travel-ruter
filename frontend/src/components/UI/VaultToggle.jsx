import React from 'react';
import { FolderOpen } from 'lucide-react';

const VaultToggle = ({ onClick, documentCount = 0 }) => {
  return (
    <button
      onClick={onClick}
      className="p-2.5 bg-white dark:bg-gray-700 rounded-xl shadow-lg hover:shadow-xl hover:bg-gray-50 dark:hover:bg-gray-600 transition-all duration-200 border border-gray-100 dark:border-gray-600 flex items-center justify-center group relative"
      aria-label="Toggle document vault"
    >
      <FolderOpen className="w-5 h-5 text-gray-600 dark:text-gray-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
      {documentCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
          {documentCount > 9 ? '9+' : documentCount}
        </span>
      )}
    </button>
  );
};

export default VaultToggle;
