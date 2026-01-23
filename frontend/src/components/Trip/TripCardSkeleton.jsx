import React from 'react';
import Skeleton from '../UI/Skeleton';

const TripCardSkeleton = () => {
  return (
    <div className="trip-card bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 h-full flex flex-col overflow-hidden">
      {/* Cover Image Skeleton */}
      <div className="relative h-40 w-full">
        <Skeleton className="w-full h-full rounded-none" />
        {/* Status Badge Skeleton */}
        <div className="absolute top-3 left-3">
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        {/* Countdown Badge Skeleton */}
        <div className="absolute bottom-3 left-3">
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
      </div>

      {/* Content Section */}
      <div className="p-5 flex-1 flex flex-col">
        {/* Title and location */}
        <div className="mb-3 space-y-2">
          <Skeleton className="h-7 w-3/4" />
          <div className="flex items-center space-x-2">
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          {/* Tags */}
          <div className="flex space-x-2 mt-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        </div>

        {/* Description */}
        <div className="space-y-2 mb-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>

        {/* Dates */}
        <div className="flex items-center mb-4">
          <Skeleton className="h-4 w-4 mr-2 rounded-full" />
          <Skeleton className="h-4 w-40" />
        </div>

        {/* Budget display */}
        <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div className="flex items-center space-x-2">
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-4 w-12" />
          </div>
          <div className="flex flex-col items-end space-y-1">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>

        {/* Progress indicator */}
        <div className="mb-4 space-y-2">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-8" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </div>

        <div className="mt-auto">
          {/* View itinerary link */}
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
};

export default TripCardSkeleton;
