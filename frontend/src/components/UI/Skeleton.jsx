import React from 'react';

const Skeleton = ({
  className = '',
  variant = 'default',
  animate = true,
  ...props
}) => {
  const baseClasses = 'rounded transition-colors';

  const variantClasses = {
    default: 'bg-stone-200 dark:bg-stone-700',
    subtle: 'bg-stone-100 dark:bg-stone-800',
    accent: 'bg-amber-100 dark:bg-amber-900/30',
  };

  const animationClass = animate ? 'skeleton-shimmer' : '';

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant] || variantClasses.default} ${animationClass} ${className}`}
      {...props}
    />
  );
};

export const SkeletonText = ({ lines = 1, className = '', ...props }) => {
  return (
    <div className={`space-y-2 ${className}`} {...props}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-4 ${i === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full'}`}
          style={{ animationDelay: `${i * 0.1}s` }}
        />
      ))}
    </div>
  );
};

export const SkeletonCircle = ({ size = 'md', className = '', ...props }) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-20 h-20',
  };

  return (
    <Skeleton
      className={`rounded-full ${sizeClasses[size] || sizeClasses.md} ${className}`}
      {...props}
    />
  );
};

export const SkeletonCard = ({ className = '', ...props }) => {
  return (
    <div
      className={`bg-white dark:bg-stone-800 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-700 overflow-hidden ${className}`}
      {...props}
    >
      <Skeleton className="h-40 w-full rounded-none" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-6 w-3/4" />
        <SkeletonText lines={2} />
        <div className="flex space-x-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </div>
    </div>
  );
};

export default Skeleton;
