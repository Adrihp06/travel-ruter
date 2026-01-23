import React from 'react';
import Skeleton from '../UI/Skeleton';

const DailyItinerarySkeleton = ({ className = '' }) => {
  return (
    <div className={`flex flex-col h-full bg-gray-50 dark:bg-gray-900 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
        <Skeleton className="h-4 w-32 mb-3" /> {/* Back button */}
        <Skeleton className="h-6 w-48 mb-2" /> {/* Title */}
        <Skeleton className="h-4 w-40 mb-2" /> {/* Dates */}
        <div className="flex items-center mt-1 space-x-3">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>

      {/* Itinerary Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Day Columns */}
        {[1, 2, 3].map((day) => (
          <div key={day} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
            {/* Day Header */}
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center">
                <Skeleton className="h-4 w-4 mr-2" />
                <Skeleton className="h-4 w-24 mr-2" />
                <Skeleton className="h-3 w-20" />
              </div>
              <div className="flex items-center space-x-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-4" />
              </div>
            </div>
            
            {/* Day Body */}
            <div className="p-2 space-y-2">
               {[1, 2].map(poi => (
                 <div key={poi} className="flex items-center p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
                    <Skeleton className="h-4 w-4 mr-2" />
                    <div className="flex-1">
                       <div className="flex justify-between mb-1">
                          <Skeleton className="h-4 w-3/4" />
                          <div className="flex space-x-1">
                             <Skeleton className="h-4 w-4 rounded" />
                             <Skeleton className="h-4 w-4 rounded" />
                          </div>
                       </div>
                       <div className="flex space-x-2">
                          <Skeleton className="h-3 w-16 rounded" />
                          <Skeleton className="h-3 w-12 rounded" />
                       </div>
                    </div>
                 </div>
               ))}
            </div>
          </div>
        ))}

        {/* Unscheduled Section */}
        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between p-3">
             <div className="flex items-center">
               <Skeleton className="h-4 w-4 mr-2" />
               <Skeleton className="h-4 w-24" />
             </div>
             <Skeleton className="h-4 w-4" />
          </div>
        </div>
      </div>
      
      {/* Footer Summary */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
    </div>
  );
};

export default DailyItinerarySkeleton;
