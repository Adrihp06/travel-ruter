import React, { useState, useEffect } from 'react';
import {
  Plane,
  Car,
  Train,
  Bus,
  Footprints,
  Bike,
  Ship,
  Clock,
  Navigation,
  MapPin,
  Settings2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import WaypointEditor from './WaypointEditor';
import TravelModeSelector from '../TravelSegment/TravelModeSelector';
import useWaypointStore from '../../stores/useWaypointStore';

const TRANSPORT_ICONS = {
  plane: Plane,
  car: Car,
  train: Train,
  bus: Bus,
  walk: Footprints,
  bike: Bike,
  ferry: Ship,
};

const formatDuration = (minutes) => {
  if (!minutes) return '--';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
};

const formatDistance = (km) => {
  if (!km) return '--';
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${Math.round(km)}km`;
};

const RouteCard = ({
  segment,
  fromCity,
  toCity,
  onModeChange,
  onAddWaypointClick,
  isCalculating = false,
  hasCoordinates = true,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showWaypointEditor, setShowWaypointEditor] = useState(false);
  const [selectedMode, setSelectedMode] = useState(segment?.travel_mode || 'car');

  const { getWaypoints, fetchSegmentWaypoints, isAddingWaypoint } = useWaypointStore();

  const waypointCount = segment ? getWaypoints(segment.id).length : 0;
  const isInAddMode = segment ? isAddingWaypoint(segment.id) : false;

  // Fetch waypoints when segment is available
  useEffect(() => {
    if (segment?.id) {
      fetchSegmentWaypoints(segment.id).catch(() => {
        // Silently fail - waypoints are optional
      });
    }
  }, [segment?.id, fetchSegmentWaypoints]);

  // Update selected mode when segment changes
  useEffect(() => {
    if (segment?.travel_mode) {
      setSelectedMode(segment.travel_mode);
    }
  }, [segment?.travel_mode]);

  const Icon = TRANSPORT_ICONS[segment?.travel_mode || selectedMode] || Car;

  const handleModeChange = async (mode) => {
    setSelectedMode(mode);
    if (onModeChange) {
      await onModeChange(mode);
    }
  };

  const toggleWaypointEditor = () => {
    setShowWaypointEditor(!showWaypointEditor);
    if (!isExpanded && !showWaypointEditor) {
      setIsExpanded(true);
    }
  };

  // Missing coordinates state
  if (!hasCoordinates) {
    return (
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4" />
          <span className="text-sm">Set coordinates to calculate route</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Compact header */}
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          {/* Transport icon */}
          <div className="p-2 rounded-full bg-gray-100 dark:bg-gray-700">
            {isCalculating ? (
              <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
            ) : (
              <Icon className="w-4 h-4 text-gray-600 dark:text-gray-300" />
            )}
          </div>

          {/* Route info */}
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-200">
              <span className="truncate max-w-[80px]">{fromCity}</span>
              <Navigation className="w-3 h-3 text-gray-400" />
              <span className="truncate max-w-[80px]">{toCity}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {isCalculating ? '...' : formatDuration(segment?.duration_minutes)}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {isCalculating ? '...' : formatDistance(segment?.distance_km)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Waypoint count badge */}
          {waypointCount > 0 && (
            <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">
              {waypointCount} waypoint{waypointCount !== 1 ? 's' : ''}
            </span>
          )}

          {/* Fallback indicator */}
          {segment?.is_fallback && (
            <span
              className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full"
              title="Using approximate route (real transit data unavailable)"
            >
              Approx
            </span>
          )}

          {/* Expand indicator */}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-3 space-y-3">
          {/* Travel mode selector */}
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
              Travel Mode
            </label>
            <TravelModeSelector
              selectedMode={selectedMode}
              onSelectMode={handleModeChange}
              disabled={isCalculating}
              compact
            />
          </div>

          {/* Customize route button */}
          <button
            onClick={toggleWaypointEditor}
            className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-sm rounded transition-colors ${
              showWaypointEditor || isInAddMode
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <Settings2 className="w-4 h-4" />
            <span>
              {showWaypointEditor ? 'Hide waypoint editor' : 'Customize route'}
            </span>
            {waypointCount > 0 && !showWaypointEditor && (
              <span className="text-xs opacity-70">({waypointCount})</span>
            )}
          </button>

          {/* Waypoint editor */}
          {showWaypointEditor && segment && (
            <WaypointEditor
              segmentId={segment.id}
              fromCity={fromCity}
              toCity={toCity}
              onClose={() => setShowWaypointEditor(false)}
              onAddWaypointClick={onAddWaypointClick}
              isAddingWaypoint={isInAddMode}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default RouteCard;
