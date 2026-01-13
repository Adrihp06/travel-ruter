import React from 'react';
import { FolderOpen } from 'lucide-react';

const VaultToggle = ({ onClick, documentCount = 0 }) => {
  return (
    <button
      onClick={onClick}
      className="fixed top-4 right-4 z-50 p-2 bg-white rounded-lg shadow-md hover:bg-gray-100 transition-colors border border-gray-200 relative"
      aria-label="Toggle document vault"
    >
      <FolderOpen className="w-6 h-6 text-gray-700" />
      {documentCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
          {documentCount > 9 ? '9+' : documentCount}
        </span>
      )}
    </button>
  );
};

export default VaultToggle;
