import React from 'react';
import Skeleton from '../UI/Skeleton';

const TripCardSkeleton = ({ index = 0 }) => {
  // Stagger animation delay based on index
  const delay = `${index * 0.1}s`;

  return (
    <div
      className="trip-card bg-white dark:bg-stone-800 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-700 h-full flex flex-col overflow-hidden animate-fade-in"
      style={{ animationDelay: delay }}
    >
      {/* Cover Image Skeleton with gradient overlay effect */}
      <div className="relative h-44 w-full overflow-hidden">
        <Skeleton className="w-full h-full rounded-none" />
        {/* Gradient overlay for depth */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
        {/* Status Badge Skeleton */}
        <div className="absolute top-3 left-3">
          <Skeleton variant="accent" className="h-6 w-20 rounded-full" style={{ animationDelay: `${0.2}s` }} />
        </div>
        {/* Countdown Badge Skeleton */}
        <div className="absolute bottom-3 left-3">
          <Skeleton className="h-7 w-28 rounded-lg backdrop-blur-sm" style={{ animationDelay: `${0.3}s` }} />
        </div>
        {/* Menu button skeleton */}
        <div className="absolute top-3 right-3">
          <Skeleton className="h-8 w-8 rounded-full" style={{ animationDelay: `${0.25}s` }} />
        </div>
      </div>

      {/* Content Section */}
      <div className="p-5 flex-1 flex flex-col">
        {/* Title and location */}
        <div className="mb-4 space-y-2.5">
          <Skeleton className="h-7 w-4/5" style={{ animationDelay: `${0.35}s` }} />
          <div className="flex items-center space-x-2">
            <Skeleton className="h-4 w-4 rounded-full flex-shrink-0" style={{ animationDelay: `${0.4}s` }} />
            <Skeleton className="h-4 w-2/3" style={{ animationDelay: `${0.4}s` }} />
          </div>
          {/* Tags */}
          <div className="flex flex-wrap gap-2 mt-2">
            <Skeleton variant="subtle" className="h-5 w-14 rounded-full" style={{ animationDelay: `${0.45}s` }} />
            <Skeleton variant="subtle" className="h-5 w-18 rounded-full" style={{ animationDelay: `${0.5}s` }} />
            <Skeleton variant="subtle" className="h-5 w-12 rounded-full" style={{ animationDelay: `${0.55}s` }} />
          </div>
        </div>

        {/* Description */}
        <div className="space-y-2 mb-4">
          <Skeleton className="h-4 w-full" style={{ animationDelay: `${0.6}s` }} />
          <Skeleton className="h-4 w-3/4" style={{ animationDelay: `${0.65}s` }} />
        </div>

        {/* Dates with icon */}
        <div className="flex items-center mb-4 p-2.5 bg-stone-50 dark:bg-stone-700/30 rounded-lg">
          <Skeleton className="h-4 w-4 mr-2.5 rounded flex-shrink-0" style={{ animationDelay: `${0.7}s` }} />
          <Skeleton className="h-4 w-44" style={{ animationDelay: `${0.7}s` }} />
        </div>

        {/* Budget display */}
        <div className="flex items-center justify-between mb-4 p-3 bg-gradient-to-r from-stone-50 to-stone-100/50 dark:from-stone-700/50 dark:to-stone-700/30 rounded-xl border border-stone-100 dark:border-stone-600/30">
          <div className="flex items-center space-x-2">
            <Skeleton className="h-5 w-5 rounded" style={{ animationDelay: `${0.75}s` }} />
            <Skeleton className="h-4 w-14" style={{ animationDelay: `${0.75}s` }} />
          </div>
          <div className="flex flex-col items-end space-y-1.5">
            <Skeleton className="h-5 w-24" style={{ animationDelay: `${0.8}s` }} />
            <Skeleton className="h-3 w-16" style={{ animationDelay: `${0.85}s` }} />
          </div>
        </div>

        {/* Progress indicator */}
        <div className="mb-4 space-y-2">
          <div className="flex justify-between">
            <Skeleton className="h-3.5 w-28" style={{ animationDelay: `${0.9}s` }} />
            <Skeleton className="h-3.5 w-10" style={{ animationDelay: `${0.9}s` }} />
          </div>
          <div className="h-2 bg-stone-100 dark:bg-stone-700 rounded-full overflow-hidden">
            <Skeleton className="h-full w-2/5 rounded-full" variant="accent" style={{ animationDelay: `${0.95}s` }} />
          </div>
        </div>

        <div className="mt-auto">
          {/* View itinerary button */}
          <Skeleton className="h-11 w-full rounded-xl" style={{ animationDelay: `${1}s` }} />
        </div>
      </div>
    </div>
  );
};

export default TripCardSkeleton;
