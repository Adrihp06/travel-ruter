import React from 'react';
import { Map } from 'lucide-react';
import Skeleton from '../UI/Skeleton';

const MapSkeleton = ({ height = '100%', className = '' }) => {
  return (
    <div 
      className={`relative bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden flex items-center justify-center ${className}`}
      style={{ height }}
    >
      <div className="absolute inset-0">
         {/* Grid pattern to simulate map */}
         <div className="w-full h-full opacity-10" 
              style={{ 
                  backgroundImage: 'radial-gradient(circle, #888 1px, transparent 1px)', 
                  backgroundSize: '20px 20px' 
              }} 
         />
      </div>
      
      <div className="flex flex-col items-center justify-center z-10 text-gray-300 dark:text-gray-600 animate-pulse">
        <Map className="w-12 h-12 mb-2" />
        <span className="text-sm font-medium">Loading Map...</span>
      </div>
      
      {/* Simulate map controls */}
      <div className="absolute top-4 right-4 flex flex-col space-y-2">
        <Skeleton className="w-8 h-8 rounded-lg" />
        <Skeleton className="w-8 h-8 rounded-lg" />
      </div>
      
      <div className="absolute bottom-6 left-6">
        <Skeleton className="w-24 h-4 rounded" />
      </div>
    </div>
  );
};

export default MapSkeleton;
