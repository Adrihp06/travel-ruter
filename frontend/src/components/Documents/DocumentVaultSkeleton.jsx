import React from 'react';
import { FolderOpen } from 'lucide-react';
import XIcon from '@/components/icons/x-icon';
import Skeleton from '../UI/Skeleton';

const DocumentVaultSkeleton = ({ isOpen, onClose }) => {
  return (
    <div
      className="fixed top-14 right-0 bottom-0 w-96 z-40 bg-white text-gray-900 shadow-xl border-l border-gray-200 flex flex-col transform transition-transform duration-300 ease-in-out"
      style={{ transform: isOpen ? 'translateX(0)' : 'translateX(100%)', colorScheme: 'light' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-amber-50 to-white">
        <div className="flex items-center space-x-2">
          <FolderOpen className="w-5 h-5 text-amber-300" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-5 w-6 rounded-full" />
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <XIcon className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* View Mode Toggle */}
      <div className="p-3 border-b border-gray-100 bg-white">
        <Skeleton className="h-8 w-full rounded-lg" />
      </div>

      {/* Filters */}
      <div className="p-3 border-b border-gray-100 bg-gray-50 space-y-2">
         <div className="flex space-x-2">
            <Skeleton className="h-9 w-full rounded-lg" />
            <Skeleton className="h-9 w-10 rounded-lg" />
         </div>
      </div>

      {/* Document List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
             <Skeleton className="h-10 w-10 rounded-lg mr-3" />
             <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <div className="flex items-center space-x-2">
                   <Skeleton className="h-3 w-16" />
                   <Skeleton className="h-3 w-12" />
                </div>
             </div>
             <div className="flex flex-col space-y-2 ml-2">
                <Skeleton className="h-6 w-6 rounded" />
             </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-200 bg-gray-50">
         <div className="flex flex-wrap gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
         </div>
      </div>
    </div>
  );
};

export default DocumentVaultSkeleton;
