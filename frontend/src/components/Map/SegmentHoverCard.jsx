import React from 'react';
import { Car, Footprints, Bike, Train, Ship, Bus } from 'lucide-react';
import TriangleAlertIcon from '@/components/icons/triangle-alert-icon';
import AirplaneIcon from '@/components/icons/airplane-icon';

// Transport mode icons mapping
const TRANSPORT_MODE_ICONS = {
  car: Car,
  driving: Car,
  walk: Footprints,
  walking: Footprints,
  bike: Bike,
  cycling: Bike,
  train: Train,
  bus: Bus,
  plane: AirplaneIcon,
  flight: AirplaneIcon,
  ferry: Ship,
};

// Transport mode colors
const TRANSPORT_MODE_COLORS = {
  car: '#D97706',
  driving: '#D97706',
  walk: '#10B981',
  walking: '#10B981',
  bike: '#F59E0B',
  cycling: '#F59E0B',
  train: '#8B5CF6',
  bus: '#EC4899',
  plane: '#3B82F6',
  flight: '#3B82F6',
  ferry: '#06B6D4',
};

// Format duration nicely
const formatDuration = (minutes) => {
  if (!minutes || minutes <= 0) return 'Unknown';
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} hr`;
  return `${hours}h ${mins}m`;
};

// Format distance
const formatDistance = (km) => {
  if (!km || km <= 0) return 'Unknown';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
};

// Format travel mode for display
const formatTravelMode = (mode) => {
  if (!mode) return 'Unknown';
  const modes = {
    car: 'Car',
    driving: 'Driving',
    walk: 'Walking',
    walking: 'Walking',
    bike: 'Cycling',
    cycling: 'Cycling',
    train: 'Train',
    bus: 'Bus',
    plane: 'Flight',
    flight: 'Flight',
    ferry: 'Ferry',
  };
  return modes[mode] || mode.charAt(0).toUpperCase() + mode.slice(1);
};

/**
 * Hover card that displays segment details
 */
const SegmentHoverCard = ({
  segment,
  fromName,
  toName,
  position = { x: 0, y: 0 },
  visible = false,
}) => {
  if (!visible || !segment) return null;

  const Icon = TRANSPORT_MODE_ICONS[segment.travel_mode] || Car;
  const color = segment.is_fallback ? '#dc2626' : (TRANSPORT_MODE_COLORS[segment.travel_mode] || TRANSPORT_MODE_COLORS.car);

  return (
    <div
      className="absolute z-50 pointer-events-none"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -100%) translateY(-12px)',
      }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-3 min-w-[200px] max-w-[280px]">
        {/* Header with transport mode */}
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100 dark:border-gray-700">
          <div
            className="p-1.5 rounded-lg"
            style={{ backgroundColor: `${color}15`, color }}
          >
            <Icon className="w-4 h-4" />
          </div>
          <span className="font-medium text-gray-900 dark:text-white">
            {formatTravelMode(segment.travel_mode)}
          </span>
          {segment.is_fallback && (
            <span className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded">
              Fallback
            </span>
          )}
        </div>

        {/* Route info */}
        <div className="space-y-1.5">
          <div className="flex items-start gap-2">
            <div className="flex flex-col items-center">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <div className="w-0.5 h-4 bg-gray-200 dark:bg-gray-600" />
              <div className="w-2 h-2 rounded-full bg-red-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-700 dark:text-gray-300 truncate" title={fromName}>
                {fromName || 'Origin'}
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300 truncate mt-2" title={toName}>
                {toName || 'Destination'}
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mt-3 pt-2 border-t border-gray-100 dark:border-gray-700">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Distance</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {formatDistance(segment.distance_km)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Duration</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {formatDuration(segment.duration_minutes)}
            </p>
          </div>
        </div>

        {/* Fallback warning */}
        {segment.is_fallback && (
          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 text-red-600 dark:text-red-400">
            <TriangleAlertIcon className="w-3.5 h-3.5" />
            <span className="text-xs">
              Public transport unavailable, showing car route
            </span>
          </div>
        )}

        {/* Click hint */}
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">
          Click to center on map
        </p>
      </div>

      {/* Arrow pointing down */}
      <div
        className="absolute left-1/2 -translate-x-1/2 w-3 h-3 bg-white dark:bg-gray-800 border-r border-b border-gray-200 dark:border-gray-700 rotate-45"
        style={{ bottom: '-6px' }}
      />
    </div>
  );
};

export default SegmentHoverCard;
