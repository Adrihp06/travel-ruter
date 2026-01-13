import React from 'react';
import { Menu } from 'lucide-react';

const SidebarToggle = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="p-2.5 bg-white rounded-xl shadow-lg hover:shadow-xl hover:bg-gray-50 transition-all duration-200 border border-gray-100 flex items-center justify-center group"
      aria-label="Toggle navigation menu"
    >
      <Menu className="w-5 h-5 text-gray-600 group-hover:text-indigo-600 transition-colors" />
    </button>
  );
};

export default SidebarToggle;
