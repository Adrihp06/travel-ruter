import React from 'react';
import {
  MapPin,
  Calendar,
  SearchX,
  Compass,
  Mountain,
  Palmtree,
  Luggage,
  Map,
  Plus,
} from 'lucide-react';
import AirplaneIcon from '@/components/icons/airplane-icon';
import SparklesIcon from '@/components/icons/sparkles-icon';

// SVG Illustrations for different empty states
const illustrations = {
  trips: (
    <svg viewBox="0 0 200 160" className="w-full h-full">
      {/* Sky background gradient */}
      <defs>
        <linearGradient id="skyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.1" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id="planeTrail" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.4" />
        </linearGradient>
      </defs>
      {/* Background circle */}
      <circle cx="100" cy="80" r="70" fill="url(#skyGradient)" />
      {/* Plane trail */}
      <path
        d="M30 90 Q 70 60, 110 70 T 170 50"
        stroke="url(#planeTrail)"
        strokeWidth="2"
        strokeDasharray="4 4"
        fill="none"
        className="animate-dash"
      />
      {/* Plane */}
      <g transform="translate(160, 45) rotate(15)">
        <path
          d="M0 0 L-8 4 L-6 1 L-20 4 L-6 0 L-20 -4 L-6 -1 L-8 -4 Z"
          fill="currentColor"
          opacity="0.8"
        />
      </g>
      {/* Clouds */}
      <g opacity="0.3">
        <ellipse cx="50" cy="50" rx="15" ry="8" fill="currentColor" />
        <ellipse cx="60" cy="48" rx="12" ry="7" fill="currentColor" />
        <ellipse cx="140" cy="90" rx="18" ry="9" fill="currentColor" />
        <ellipse cx="155" cy="88" rx="14" ry="8" fill="currentColor" />
      </g>
      {/* Globe/Earth at bottom */}
      <circle cx="100" cy="130" r="25" fill="currentColor" opacity="0.15" />
      <path
        d="M80 130 Q 100 120, 120 130 Q 100 140, 80 130"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        opacity="0.3"
      />
      <path
        d="M100 105 L 100 155"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        opacity="0.2"
      />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 200 160" className="w-full h-full">
      <defs>
        <linearGradient id="searchBg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.08" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* Background */}
      <circle cx="100" cy="80" r="65" fill="url(#searchBg)" />
      {/* Magnifying glass */}
      <circle
        cx="90"
        cy="70"
        r="30"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
        opacity="0.4"
      />
      <line
        x1="112"
        y1="92"
        x2="135"
        y2="115"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.4"
      />
      {/* X inside */}
      <g opacity="0.6">
        <line x1="78" y1="58" x2="102" y2="82" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <line x1="102" y1="58" x2="78" y2="82" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </g>
      {/* Scattered dots representing no results */}
      <g opacity="0.2">
        <circle cx="45" cy="45" r="3" fill="currentColor" />
        <circle cx="155" cy="55" r="2" fill="currentColor" />
        <circle cx="40" cy="100" r="2" fill="currentColor" />
        <circle cx="160" cy="105" r="3" fill="currentColor" />
      </g>
    </svg>
  ),
  pois: (
    <svg viewBox="0 0 200 160" className="w-full h-full">
      <defs>
        <linearGradient id="mapBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.08" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.03" />
        </linearGradient>
      </defs>
      {/* Map background */}
      <rect x="30" y="30" width="140" height="100" rx="8" fill="url(#mapBg)" />
      {/* Map fold lines */}
      <path d="M75 30 L75 130" stroke="currentColor" strokeWidth="1" opacity="0.1" strokeDasharray="4 4" />
      <path d="M125 30 L125 130" stroke="currentColor" strokeWidth="1" opacity="0.1" strokeDasharray="4 4" />
      {/* Map pin placeholder */}
      <g transform="translate(100, 75)">
        <circle r="20" fill="currentColor" opacity="0.1" />
        <path
          d="M0 -15 C -8 -15, -12 -8, -12 -4 C -12 5, 0 15, 0 15 C 0 15, 12 5, 12 -4 C 12 -8, 8 -15, 0 -15"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          opacity="0.4"
          strokeDasharray="3 3"
        />
        <circle cx="0" cy="-5" r="4" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.4" />
        <text x="0" y="1" textAnchor="middle" fontSize="14" fill="currentColor" opacity="0.5">?</text>
      </g>
      {/* Corner decorations */}
      <circle cx="50" cy="50" r="4" fill="currentColor" opacity="0.15" />
      <circle cx="150" cy="50" r="4" fill="currentColor" opacity="0.15" />
      <circle cx="50" cy="110" r="4" fill="currentColor" opacity="0.15" />
      <circle cx="150" cy="110" r="4" fill="currentColor" opacity="0.15" />
    </svg>
  ),
  destinations: (
    <svg viewBox="0 0 200 160" className="w-full h-full">
      <defs>
        <linearGradient id="destBg" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.1" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* Horizon line */}
      <rect x="20" y="110" width="160" height="30" fill="url(#destBg)" rx="4" />
      {/* Mountains */}
      <path
        d="M20 110 L60 60 L80 85 L100 50 L130 90 L150 70 L180 110 Z"
        fill="currentColor"
        opacity="0.15"
      />
      <path
        d="M40 110 L70 75 L85 90 L100 65 L120 95 L180 110 Z"
        fill="currentColor"
        opacity="0.1"
      />
      {/* Sun */}
      <circle cx="150" cy="40" r="15" fill="currentColor" opacity="0.2" />
      {/* Sun rays */}
      <g stroke="currentColor" strokeWidth="2" opacity="0.15">
        <line x1="150" y1="18" x2="150" y2="10" />
        <line x1="165" y1="25" x2="171" y2="19" />
        <line x1="172" y1="40" x2="180" y2="40" />
        <line x1="165" y1="55" x2="171" y2="61" />
        <line x1="135" y1="55" x2="129" y2="61" />
        <line x1="128" y1="40" x2="120" y2="40" />
        <line x1="135" y1="25" x2="129" y2="19" />
      </g>
      {/* Compass rose */}
      <g transform="translate(50, 45)" opacity="0.3">
        <circle r="15" fill="none" stroke="currentColor" strokeWidth="1" />
        <path d="M0 -12 L3 0 L0 12 L-3 0 Z" fill="currentColor" />
        <circle r="3" fill="currentColor" opacity="0.5" />
      </g>
    </svg>
  ),
  schedule: (
    <svg viewBox="0 0 200 160" className="w-full h-full">
      <defs>
        <linearGradient id="calBg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.1" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.03" />
        </linearGradient>
      </defs>
      {/* Calendar base */}
      <rect x="45" y="35" width="110" height="95" rx="8" fill="url(#calBg)" stroke="currentColor" strokeWidth="2" opacity="0.3" />
      {/* Calendar header */}
      <rect x="45" y="35" width="110" height="25" rx="8" fill="currentColor" opacity="0.15" />
      <circle cx="65" cy="35" r="5" fill="currentColor" opacity="0.3" />
      <circle cx="135" cy="35" r="5" fill="currentColor" opacity="0.3" />
      {/* Grid lines */}
      <g stroke="currentColor" strokeWidth="1" opacity="0.1">
        <line x1="45" y1="75" x2="155" y2="75" />
        <line x1="45" y1="100" x2="155" y2="100" />
        <line x1="82" y1="60" x2="82" y2="130" />
        <line x1="118" y1="60" x2="118" y2="130" />
      </g>
      {/* Empty day indicators */}
      <g opacity="0.2">
        <circle cx="63" cy="85" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
        <circle cx="100" cy="85" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
        <circle cx="137" cy="85" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
        <circle cx="63" cy="115" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
        <circle cx="100" cy="115" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
        <circle cx="137" cy="115" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
      </g>
    </svg>
  ),
};

// Icon components for different empty states
const emptyStateIcons = {
  trips: AirplaneIcon,
  search: SearchX,
  pois: MapPin,
  destinations: Compass,
  schedule: Calendar,
};

// Default messages for different types
const defaultMessages = {
  trips: {
    title: 'No trips yet',
    description: 'Start planning your next adventure! Create your first trip to explore new destinations.',
    actionLabel: 'Create Your First Trip',
  },
  search: {
    title: 'No results found',
    description: 'Try adjusting your search terms or clearing filters to see more results.',
    actionLabel: 'Clear Filters',
  },
  pois: {
    title: 'No places added yet',
    description: 'Discover and add interesting places to visit during your trip.',
    actionLabel: 'Explore Places',
  },
  destinations: {
    title: 'No destinations planned',
    description: 'Add destinations to build your travel itinerary.',
    actionLabel: 'Add Destination',
  },
  schedule: {
    title: 'Nothing scheduled',
    description: 'Drag places from your list to schedule them for this day.',
    actionLabel: 'Browse Places',
  },
};

const EmptyState = ({
  type = 'trips',
  title,
  description,
  actionLabel,
  onAction,
  icon: CustomIcon,
  showIllustration = true,
  size = 'md',
  className = '',
}) => {
  const Icon = CustomIcon || emptyStateIcons[type] || AirplaneIcon;
  const defaults = defaultMessages[type] || defaultMessages.trips;

  const sizeClasses = {
    sm: {
      container: 'py-8',
      illustration: 'w-24 h-20',
      iconContainer: 'w-12 h-12',
      icon: 'w-6 h-6',
      title: 'text-base',
      description: 'text-sm max-w-xs',
      button: 'px-4 py-2 text-sm',
    },
    md: {
      container: 'py-12',
      illustration: 'w-40 h-32',
      iconContainer: 'w-16 h-16',
      icon: 'w-8 h-8',
      title: 'text-lg',
      description: 'text-sm max-w-sm',
      button: 'px-5 py-2.5 text-sm',
    },
    lg: {
      container: 'py-16',
      illustration: 'w-52 h-40',
      iconContainer: 'w-20 h-20',
      icon: 'w-10 h-10',
      title: 'text-xl',
      description: 'text-base max-w-md',
      button: 'px-6 py-3',
    },
  };

  const sizes = sizeClasses[size] || sizeClasses.md;

  return (
    <div className={`text-center animate-fade-in ${sizes.container} ${className}`}>
      {/* Illustration or Icon */}
      {showIllustration && illustrations[type] ? (
        <div className={`mx-auto mb-6 text-amber-500 dark:text-amber-400 ${sizes.illustration}`}>
          {illustrations[type]}
        </div>
      ) : (
        <div
          className={`mx-auto mb-6 bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-900/40 dark:to-amber-800/20 rounded-full flex items-center justify-center shadow-inner ${sizes.iconContainer}`}
        >
          <Icon className={`text-amber-600 dark:text-amber-400 ${sizes.icon}`} />
        </div>
      )}

      {/* Title */}
      <h3 className={`font-semibold text-stone-700 dark:text-stone-200 mb-2 ${sizes.title}`}>
        {title || defaults.title}
      </h3>

      {/* Description */}
      <p className={`text-stone-500 dark:text-stone-400 mx-auto mb-6 ${sizes.description}`}>
        {description || defaults.description}
      </p>

      {/* Action Button */}
      {onAction && (
        <button
          onClick={onAction}
          className={`
            inline-flex items-center space-x-2
            bg-gradient-to-r from-amber-500 to-amber-600
            hover:from-amber-600 hover:to-amber-700
            text-white font-medium rounded-xl
            transition-all duration-200
            shadow-md hover:shadow-lg
            hover:-translate-y-0.5
            active:translate-y-0
            ${sizes.button}
          `}
        >
          <Plus className="w-4 h-4" />
          <span>{actionLabel || defaults.actionLabel}</span>
        </button>
      )}
    </div>
  );
};

// Compact inline empty state for smaller contexts
export const InlineEmptyState = ({
  message = 'No items',
  icon: Icon = SparklesIcon,
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center py-6 px-4 ${className}`}>
      <div className="p-2 rounded-full bg-stone-100 dark:bg-stone-800 mb-2">
        <Icon className="w-5 h-5 text-stone-400 dark:text-stone-500" />
      </div>
      <span className="text-sm text-stone-500 dark:text-stone-400 italic">{message}</span>
    </div>
  );
};

export default EmptyState;
