import React, { useState, useEffect } from 'react';
import { Plane, Car, Train, Bus, Footprints, Bike, Ship, Clock, MapPin, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import TravelModeSelector from './TravelModeSelector';

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
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
};

const formatDistance = (km) => {
  if (!km) return '--';
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${Math.round(km)}km`;
};

const TravelSegmentCard = ({
  segment,
  fromCity,
  toCity,
  onModeChange,
  isCalculating = false,
  hasFetchedInitial = false,
  expanded = false,
  hasCoordinates = true,
  error = null,
}) => {
  const [isExpanded, setIsExpanded] = useState(expanded);
  const [selectedMode, setSelectedMode] = useState(segment?.travel_mode || 'car');
  const [hasTriggeredInitialCalc, setHasTriggeredInitialCalc] = useState(false);
  const [calcError, setCalcError] = useState(null);

  // Auto-calculate on first render if no segment exists and has coordinates
  // Wait until initial segment fetch completes to avoid overwriting saved travel_mode
  useEffect(() => {
    if (!segment && !isCalculating && hasFetchedInitial && !hasTriggeredInitialCalc && onModeChange && hasCoordinates) {
      setHasTriggeredInitialCalc(true);
      setCalcError(null);
      onModeChange('car').catch(err => {
        setCalcError(err?.message || 'Calculation failed');
      });
    }
  }, [segment, isCalculating, hasFetchedInitial, hasTriggeredInitialCalc, onModeChange, hasCoordinates]);

  // Update selected mode when segment changes
  useEffect(() => {
    if (segment?.travel_mode) {
      setSelectedMode(segment.travel_mode);
      setCalcError(null); // Clear error on successful segment
    }
  }, [segment?.travel_mode]);

  const Icon = TRANSPORT_ICONS[segment?.travel_mode || selectedMode] || Car;
  const displayError = error || calcError;

  const handleModeChange = async (mode) => {
    setSelectedMode(mode);
    setCalcError(null);
    if (onModeChange) {
      try {
        await onModeChange(mode);
      } catch (err) {
        setCalcError(err?.message || 'Calculation failed');
      }
    }
  };

  // Show error or missing coordinates state
  if (!hasCoordinates) {
    return (
      <div className="flex items-center text-xs text-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded px-2 py-1.5 ml-2">
        <span>Set coordinates to calculate travel time</span>
      </div>
    );
  }

  // Compact view (default in timeline)
  if (!isExpanded) {
    // Show error state if calculation failed
    if (displayError && !segment && !isCalculating) {
      return (
        <div
          className="flex items-center justify-between text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded px-2 py-1.5 ml-2 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
          onClick={() => setIsExpanded(true)}
          title={displayError}
        >
          <div className="flex items-center gap-2">
            <Icon className="w-3 h-3" />
            <span>Click to retry</span>
          </div>
          <ChevronDown className="w-3 h-3 text-red-300 dark:text-red-600" />
        </div>
      );
    }

    return (
      <div
        className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-700 rounded px-2 py-1.5 ml-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
        onClick={() => setIsExpanded(true)}
      >
        <div className="flex items-center gap-2">
          {isCalculating ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Icon className="w-3 h-3" />
          )}
          <span>{isCalculating ? 'Calculating...' : formatDuration(segment?.duration_minutes)}</span>
          {segment?.distance_km && !isCalculating && (
            <>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <span>{formatDistance(segment?.distance_km)}</span>
            </>
          )}
        </div>
        <ChevronDown className="w-3 h-3 text-gray-300 dark:text-gray-600 chevron-animate" />
      </div>
    );
  }

  // Expanded view with mode selector
  return (
    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg px-3 py-2 ml-2 space-y-2">
      {/* Header with collapse button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <MapPin className="w-3 h-3" />
          <span className="truncate max-w-[100px]">{fromCity}</span>
          <span>→</span>
          <span className="truncate max-w-[100px]">{toCity}</span>
        </div>
        <button
          onClick={() => setIsExpanded(false)}
          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
        >
          <ChevronUp className="w-3 h-3 text-gray-400 chevron-animate rotated" />
        </button>
      </div>

      {/* Travel info */}
      <div className="flex items-center gap-3 text-sm">
        {isCalculating ? (
          <div className="flex items-center gap-2 text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Calculating...</span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
              <Clock className="w-4 h-4" />
              <span className="font-medium">{formatDuration(segment?.duration_minutes)}</span>
            </div>
            {segment?.distance_km && (
              <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                <MapPin className="w-4 h-4" />
                <span>{formatDistance(segment?.distance_km)}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Mode selector */}
      <div className="pt-1">
        <TravelModeSelector
          selectedMode={selectedMode}
          onSelectMode={handleModeChange}
          disabled={isCalculating}
          compact
        />
      </div>
    </div>
  );
};

export default TravelSegmentCard;
export { formatDuration, formatDistance, TRANSPORT_ICONS };
