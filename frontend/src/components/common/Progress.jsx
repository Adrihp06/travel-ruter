import React from 'react';

/**
 * Progress Components
 *
 * Includes: ProgressBar, ProgressCircle, Skeleton
 */

// Linear Progress Bar
export const ProgressBar = ({
  value = 0,
  max = 100,
  size = 'md',
  variant = 'primary',
  showLabel = false,
  labelPosition = 'right',
  animated = false,
  striped = false,
  className = '',
}) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  // Size styles
  const sizes = {
    xs: 'h-1',
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
    xl: 'h-4',
  };

  // Variant colors
  const variants = {
    primary: 'bg-[#D97706] dark:bg-[#D97706]',
    success: 'bg-green-600 dark:bg-green-500',
    warning: 'bg-yellow-500 dark:bg-yellow-400',
    error: 'bg-red-600 dark:bg-red-500',
    info: 'bg-blue-600 dark:bg-blue-500',
  };

  return (
    <div className={`w-full ${className}`}>
      {showLabel && labelPosition === 'top' && (
        <div className="flex justify-between mb-1 text-sm">
          <span className="text-gray-600 dark:text-gray-400">Progress</span>
          <span className="font-medium text-gray-900 dark:text-white">{Math.round(percentage)}%</span>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div
          className={`
            flex-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden
            ${sizes[size]}
          `}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        >
          <div
            className={`
              h-full rounded-full transition-all duration-300 ease-out
              ${variants[variant]}
              ${striped ? 'bg-stripes' : ''}
              ${animated ? 'animate-progress' : ''}
            `}
            style={{ width: `${percentage}%` }}
          />
        </div>

        {showLabel && labelPosition === 'right' && (
          <span className="text-sm font-medium text-gray-900 dark:text-white min-w-[3ch]">
            {Math.round(percentage)}%
          </span>
        )}
      </div>
    </div>
  );
};

// Circular Progress
export const ProgressCircle = ({
  value = 0,
  max = 100,
  size = 'md',
  variant = 'primary',
  thickness = 4,
  showLabel = true,
  className = '',
}) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  // Size configurations
  const sizes = {
    sm: { size: 32, fontSize: 'text-xs' },
    md: { size: 48, fontSize: 'text-sm' },
    lg: { size: 64, fontSize: 'text-base' },
    xl: { size: 80, fontSize: 'text-lg' },
  };

  // Variant colors
  const variants = {
    primary: 'stroke-amber-600 dark:stroke-amber-500',
    success: 'stroke-green-600 dark:stroke-green-500',
    warning: 'stroke-yellow-500 dark:stroke-yellow-400',
    error: 'stroke-red-600 dark:stroke-red-500',
    info: 'stroke-blue-600 dark:stroke-blue-500',
  };

  const config = sizes[size];
  const radius = (config.size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg
        width={config.size}
        height={config.size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={config.size / 2}
          cy={config.size / 2}
          r={radius}
          fill="none"
          strokeWidth={thickness}
          className="stroke-gray-200 dark:stroke-gray-700"
        />
        {/* Progress circle */}
        <circle
          cx={config.size / 2}
          cy={config.size / 2}
          r={radius}
          fill="none"
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`${variants[variant]} transition-all duration-300 ease-out`}
        />
      </svg>

      {showLabel && (
        <span className={`absolute ${config.fontSize} font-medium text-gray-900 dark:text-white`}>
          {Math.round(percentage)}%
        </span>
      )}
    </div>
  );
};

// Indeterminate Progress (Spinner)
export const IndeterminateProgress = ({
  size = 'md',
  variant = 'primary',
  className = '',
}) => {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-10 h-10',
  };

  const variants = {
    primary: 'text-[#D97706] dark:text-[#D97706]',
    success: 'text-green-600 dark:text-green-500',
    warning: 'text-yellow-500 dark:text-yellow-400',
    error: 'text-red-600 dark:text-red-500',
    info: 'text-blue-600 dark:text-blue-500',
    white: 'text-white',
  };

  return (
    <svg
      className={`animate-spin ${sizes[size]} ${variants[variant]} ${className}`}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
};

// Skeleton Loading
export const Skeleton = ({
  variant = 'text',
  width,
  height,
  className = '',
  lines = 1,
  animate = true,
}) => {
  // Variant styles
  const variants = {
    text: 'h-4 rounded',
    title: 'h-6 rounded',
    avatar: 'w-10 h-10 rounded-full',
    thumbnail: 'w-16 h-16 rounded-lg',
    button: 'h-10 w-24 rounded-lg',
    card: 'h-40 w-full rounded-xl',
    rectangular: 'rounded',
    circular: 'rounded-full',
  };

  const baseStyles = `
    bg-gray-200 dark:bg-gray-700
    ${animate ? 'animate-pulse' : ''}
    ${variants[variant]}
  `;

  // For multi-line text
  if (variant === 'text' && lines > 1) {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={`${baseStyles} ${i === lines - 1 ? 'w-3/4' : 'w-full'}`}
            style={{ width: i === lines - 1 ? '75%' : width }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`${baseStyles} ${className}`}
      style={{
        width: width,
        height: height,
      }}
    />
  );
};

// Skeleton Group for loading states
export const SkeletonGroup = ({ children, loading = true }) => {
  if (!loading) return children;

  return (
    <div className="animate-pulse">
      {children}
    </div>
  );
};

export default ProgressBar;
