import React from 'react';
import { Map, Navigation, Compass } from 'lucide-react';
import Skeleton from '../UI/Skeleton';

const MapSkeleton = ({ height = '100%', className = '' }) => {
  return (
    <div
      className={`relative bg-gradient-to-br from-stone-100 via-stone-50 to-stone-100 dark:from-stone-800 dark:via-stone-850 dark:to-stone-800 rounded-xl overflow-hidden flex items-center justify-center ${className}`}
      style={{ height }}
    >
      {/* Animated map pattern background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Organic blob shapes simulating map features */}
        <div className="absolute top-[10%] left-[15%] w-32 h-24 bg-stone-200/60 dark:bg-stone-700/40 rounded-[40%_60%_70%_30%] animate-pulse-slow" />
        <div className="absolute top-[30%] right-[20%] w-40 h-28 bg-stone-200/50 dark:bg-stone-700/30 rounded-[60%_40%_30%_70%] animate-pulse-slow" style={{ animationDelay: '0.5s' }} />
        <div className="absolute bottom-[25%] left-[25%] w-36 h-20 bg-stone-200/40 dark:bg-stone-700/35 rounded-[30%_70%_60%_40%] animate-pulse-slow" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-[15%] right-[30%] w-28 h-24 bg-stone-200/55 dark:bg-stone-700/25 rounded-[50%_50%_40%_60%] animate-pulse-slow" style={{ animationDelay: '0.75s' }} />

        {/* Grid pattern for map texture */}
        <div
          className="w-full h-full opacity-[0.07] dark:opacity-[0.1]"
          style={{
            backgroundImage: `
              linear-gradient(to right, currentColor 1px, transparent 1px),
              linear-gradient(to bottom, currentColor 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        />

        {/* Subtle route lines */}
        <svg className="absolute inset-0 w-full h-full opacity-20 dark:opacity-15" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path
            d="M 10 60 Q 30 40, 50 50 T 90 40"
            stroke="currentColor"
            strokeWidth="0.5"
            strokeDasharray="2 1"
            fill="none"
            className="text-amber-500 animate-dash-slow"
          />
          <path
            d="M 20 80 Q 40 60, 60 70 T 85 55"
            stroke="currentColor"
            strokeWidth="0.4"
            strokeDasharray="1.5 0.75"
            fill="none"
            className="text-stone-400 animate-dash-slow"
            style={{ animationDelay: '1s' }}
          />
        </svg>

        {/* Placeholder map pins */}
        <div className="absolute top-[35%] left-[30%] animate-float" style={{ animationDelay: '0s' }}>
          <div className="w-6 h-6 bg-amber-400/40 dark:bg-amber-500/30 rounded-full flex items-center justify-center">
            <div className="w-3 h-3 bg-amber-500/60 dark:bg-amber-400/50 rounded-full" />
          </div>
        </div>
        <div className="absolute top-[50%] right-[35%] animate-float" style={{ animationDelay: '0.3s' }}>
          <div className="w-5 h-5 bg-stone-300/50 dark:bg-stone-600/40 rounded-full flex items-center justify-center">
            <div className="w-2.5 h-2.5 bg-stone-400/60 dark:bg-stone-500/50 rounded-full" />
          </div>
        </div>
        <div className="absolute bottom-[35%] left-[55%] animate-float" style={{ animationDelay: '0.6s' }}>
          <div className="w-4 h-4 bg-stone-300/40 dark:bg-stone-600/30 rounded-full flex items-center justify-center">
            <div className="w-2 h-2 bg-stone-400/50 dark:bg-stone-500/40 rounded-full" />
          </div>
        </div>
      </div>

      {/* Center loading indicator */}
      <div className="relative z-10 flex flex-col items-center justify-center">
        <div className="relative">
          {/* Outer ring */}
          <div className="absolute inset-0 w-20 h-20 border-4 border-stone-200/50 dark:border-stone-600/40 rounded-full" />
          {/* Spinning compass */}
          <div className="w-20 h-20 flex items-center justify-center animate-spin-slow">
            <Compass className="w-10 h-10 text-amber-500/60 dark:text-amber-400/50" />
          </div>
        </div>
        <div className="mt-4 flex items-center space-x-2 text-stone-400 dark:text-stone-500">
          <span className="text-sm font-medium">Loading map</span>
          <span className="flex space-x-1">
            <span className="w-1.5 h-1.5 bg-stone-400 dark:bg-stone-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
            <span className="w-1.5 h-1.5 bg-stone-400 dark:bg-stone-500 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
            <span className="w-1.5 h-1.5 bg-stone-400 dark:bg-stone-500 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
          </span>
        </div>
      </div>

      {/* Map controls skeleton */}
      <div className="absolute top-4 right-4 flex flex-col space-y-2">
        <Skeleton className="w-9 h-9 rounded-lg shadow-sm" style={{ animationDelay: '0.2s' }} />
        <Skeleton className="w-9 h-9 rounded-lg shadow-sm" style={{ animationDelay: '0.3s' }} />
        <div className="w-9 h-px bg-stone-200 dark:bg-stone-600 my-1" />
        <Skeleton className="w-9 h-9 rounded-lg shadow-sm" style={{ animationDelay: '0.4s' }} />
      </div>

      {/* Scale bar skeleton */}
      <div className="absolute bottom-4 left-4 flex items-center space-x-2">
        <Skeleton className="w-20 h-3 rounded" style={{ animationDelay: '0.5s' }} />
        <span className="text-xs text-stone-400 dark:text-stone-500">—</span>
        <Skeleton className="w-12 h-3 rounded" style={{ animationDelay: '0.6s' }} />
      </div>

      {/* Attribution skeleton */}
      <div className="absolute bottom-4 right-4">
        <Skeleton className="w-32 h-3 rounded" style={{ animationDelay: '0.7s' }} />
      </div>
    </div>
  );
};

export default MapSkeleton;
