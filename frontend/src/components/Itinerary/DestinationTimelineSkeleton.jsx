import React from 'react';
import Skeleton from '../UI/Skeleton';

const DestinationTimelineSkeleton = () => {
  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 w-80 overflow-y-auto">
      {/* Trip Header Skeleton */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
        <Skeleton className="h-4 w-20 mb-1" />
        <Skeleton className="h-3 w-32" />
      </div>

      <div className="flex-1 p-4">
        {/* Start Marker */}
        <div className="flex items-center mb-4">
          <div className="w-3 h-3 rounded-full border-2 border-gray-300 dark:border-gray-600 mr-3"></div>
          <Skeleton className="h-3 w-24" />
        </div>

        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-1.5 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-600"></div>

          {/* Destination Items */}
          {[1, 2, 3].map((i) => (
            <div key={i} className="mb-4">
              {/* Destination Card */}
              <div className="relative z-10 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm ml-4 mb-2">
                <div className="flex justify-between items-start mb-2">
                   <Skeleton className="h-4 w-3/4 mb-1" />
                </div>
                <div className="flex items-center space-x-2">
                   <Skeleton className="h-3 w-4 rounded-full" />
                   <Skeleton className="h-3 w-20" />
                </div>
              </div>

              {/* Travel Segment */}
              <div className="relative pl-6 py-2">
                 <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                       <Skeleton className="h-3 w-12" />
                       <Skeleton className="h-4 w-16" />
                    </div>
                 </div>
              </div>
            </div>
          ))}
        </div>

        {/* End Marker */}
        <div className="flex items-center mt-2">
          <div className="w-3 h-3 rounded-full border-2 border-gray-300 dark:border-gray-600 mr-3"></div>
          <Skeleton className="h-3 w-24" />
        </div>
        
        {/* Add Button */}
        <Skeleton className="w-full h-12 mt-4 rounded-lg" />
      </div>
    </div>
  );
};

export default DestinationTimelineSkeleton;
