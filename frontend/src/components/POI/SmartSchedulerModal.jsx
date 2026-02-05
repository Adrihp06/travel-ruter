import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  X,
  Check,
  Sparkles,
  Clock,
  UtensilsCrossed,
  Calendar,
  Route,
  AlertTriangle,
  MapPin,
  ChevronDown,
  ChevronRight,
  Loader2,
  Home,
  Footprints,
  Bike,
  Car,
  Bus,
  Navigation,
  Lock,
  Infinity,
} from 'lucide-react';
import usePOIStore from '../../stores/usePOIStore';
import {
  generateSmartSchedule,
  getSchedulePreview,
  DEFAULT_CONSTRAINTS,
} from '../../utils/poiScheduler';

// Transport mode configurations
const TRANSPORT_MODES = [
  { id: 'foot-walking', label: 'Walk', icon: Footprints, orsProfile: 'foot-walking' },
  { id: 'cycling-regular', label: 'Bike', icon: Bike, orsProfile: 'cycling-regular' },
  { id: 'driving-car', label: 'Drive', icon: Car, orsProfile: 'driving-car' },
  { id: 'public-transit', label: 'Bus', icon: Bus, orsProfile: 'driving-car', multiplier: 1.5 },
  // Note: Transit uses driving matrix x 1.5 (no ORS transit support)
];

// Category color mapping (same as DailyItinerary)
const categoryColors = {
  'Sights': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  'Museums': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  'Food': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  'Restaurants': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  'Viewpoints': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  'Nature': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  'Shopping': 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  'Entertainment': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  'Photography': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  'Accommodation': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  'Activity': 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  'Museum': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
};

// POI chip component for preview
const POIChip = ({ poi }) => {
  const colorClass = categoryColors[poi.category] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colorClass} truncate max-w-[160px]`}
      title={poi.name}
    >
      {poi.is_anchored && (
        <Lock className="w-3 h-3 flex-shrink-0" />
      )}
      {poi.name}
    </span>
  );
};

// Day preview card
const DayPreviewCard = ({ dayPreview, isExpanded, onToggle, showTravelTime = false, noTimeLimit = false }) => {
  const {
    dayNumber,
    displayDate,
    pois,
    dwellTimeHours,
    travelTimeMinutes,
    totalTimeHours,
    foodCount,
    warnings,
    warningsLegacy,
    accommodation,
    anchoredCount,
  } = dayPreview;

  // Only show time warnings if there's a time limit
  const hasWarnings = (warnings?.some(w => w.severity === 'error' && w.type !== 'time_exceeded') ||
    warningsLegacy?.foodExceeded) ||
    (!noTimeLimit && (warnings?.some(w => w.type === 'time_exceeded') || warningsLegacy?.timeExceeded));

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${
      hasWarnings
        ? 'border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/10'
        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
    }`}>
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
          <span className="font-medium text-sm text-gray-900 dark:text-white">
            Day {dayNumber}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {displayDate}
          </span>
          {/* Accommodation indicator */}
          {accommodation?.name ? (
            <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-full">
              <Home className="w-3 h-3" />
              <span className="max-w-[100px] truncate">{accommodation.name}</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-3 h-3" />
              <span>No accommodation</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* POI count badge */}
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            pois.length > 0
              ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
              : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
          }`}>
            {pois.length} POI{pois.length !== 1 ? 's' : ''}
            {anchoredCount > 0 && (
              <span className="ml-1 text-amber-600 dark:text-amber-400">
                ({anchoredCount} locked)
              </span>
            )}
          </span>

          {/* Time badge - show total time if travel time enabled */}
          <span className={`flex items-center gap-1 text-xs ${
            noTimeLimit
              ? 'text-gray-500 dark:text-gray-400'
              : warningsLegacy?.timeExceeded
              ? 'text-red-600 dark:text-red-400'
              : warningsLegacy?.atTimeLimit
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-gray-500 dark:text-gray-400'
          }`}>
            <Clock className="w-3 h-3" />
            {showTravelTime ? (
              <span>
                {totalTimeHours}h
                <span className="text-gray-400 dark:text-gray-500 ml-0.5">
                  ({dwellTimeHours}+{Math.round(travelTimeMinutes / 6) / 10}h travel)
                </span>
              </span>
            ) : (
              <span>{dwellTimeHours}h</span>
            )}
          </span>

          {/* Food badge */}
          {foodCount > 0 && (
            <span className={`flex items-center gap-1 text-xs ${
              warningsLegacy?.foodExceeded
                ? 'text-red-600 dark:text-red-400'
                : warningsLegacy?.atFoodLimit
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-orange-500 dark:text-orange-400'
            }`}>
              <UtensilsCrossed className="w-3 h-3" />
              {foodCount}
            </span>
          )}

          {/* Warning icon */}
          {hasWarnings && (
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          )}

          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* Day-level warnings */}
      {isExpanded && warnings && warnings.length > 0 && (
        <div className="px-3 pt-2 space-y-1">
          {warnings
            .filter(w => noTimeLimit ? (w.type !== 'time_exceeded' && w.type !== 'time_near_limit') : true)
            .map((warning, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${
                warning.severity === 'error'
                  ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                  : warning.severity === 'warning'
                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
                  : 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
              }`}
            >
              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
              <span>{warning.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Expanded content */}
      {isExpanded && pois.length > 0 && (
        <div className="px-3 pb-3 border-t border-gray-100 dark:border-gray-700 mt-2">
          <div className="flex flex-wrap gap-1.5 mt-2">
            {pois.map((poi) => (
              <POIChip key={poi.id} poi={poi} />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {isExpanded && pois.length === 0 && (
        <div className="px-3 pb-3 border-t border-gray-100 dark:border-gray-700 mt-2">
          <div className="flex items-center justify-center py-3 text-gray-400 dark:text-gray-500 text-xs">
            <MapPin className="w-3.5 h-3.5 mr-1.5" />
            No POIs scheduled
          </div>
        </div>
      )}
    </div>
  );
};

// Transport Mode Selector component
const TransportModeSelector = ({ selectedMode, onModeChange, isLoading, loadingMode }) => {
  return (
    <div className="flex items-center gap-1.5">
      <Navigation className="w-4 h-4 text-gray-400 mr-1" />
      {TRANSPORT_MODES.map((mode) => {
        const Icon = mode.icon;
        const isSelected = selectedMode === mode.id;
        const isLoadingThis = isLoading && loadingMode === mode.id;

        return (
          <button
            key={mode.id}
            onClick={() => onModeChange(mode.id)}
            disabled={isLoading}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              isSelected
                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 ring-1 ring-indigo-300 dark:ring-indigo-700'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            } ${isLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
            title={mode.id === 'public-transit' ? 'Estimated as 1.5x driving time' : mode.label}
          >
            {isLoadingThis ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Icon className="w-3.5 h-3.5" />
            )}
            {mode.label}
          </button>
        );
      })}
    </div>
  );
};

const SmartSchedulerModal = ({
  isOpen,
  onClose,
  onApply,
  allPOIs,
  days,
  unscheduled,
  destinationId,
  isApplying = false,
}) => {
  // Configuration state
  const [includeScheduled, setIncludeScheduled] = useState(false);
  const [maxFoodPerDay, setMaxFoodPerDay] = useState(DEFAULT_CONSTRAINTS.maxFoodPerDay);
  const [maxHoursPerDay, setMaxHoursPerDay] = useState(DEFAULT_CONSTRAINTS.maxHoursPerDay);
  const [noTimeLimit, setNoTimeLimit] = useState(false);
  const [optimizeRoutes, setOptimizeRoutes] = useState(true);

  // Transport mode and matrix state
  const [transportMode, setTransportMode] = useState('foot-walking');
  const [matrixCache, setMatrixCache] = useState({});
  const [isLoadingMatrix, setIsLoadingMatrix] = useState(false);
  const [matrixError, setMatrixError] = useState(null);
  const [loadingMode, setLoadingMode] = useState(null);

  // Accommodation state
  const [accommodationsByDay, setAccommodationsByDay] = useState({});
  const [isLoadingAccom, setIsLoadingAccom] = useState(false);

  const { getAccommodationForDay, fetchTravelMatrix } = usePOIStore();

  // UI state - initialize expanded days from the days prop
  const [expandedDays, setExpandedDays] = useState(() => {
    const expanded = {};
    days.forEach(day => {
      expanded[day.date] = true;
    });
    return expanded;
  });

  // Update expanded days when days change (e.g., on modal reopen)
  const daysKey = days.map(d => d.date).join(',');
  useEffect(() => {
    const expanded = {};
    days.forEach(day => {
      expanded[day.date] = true;
    });
    setExpandedDays(expanded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daysKey]);

  // Fetch accommodations for all days when modal opens
  useEffect(() => {
    if (isOpen && destinationId && days.length > 0) {
      setIsLoadingAccom(true);
      Promise.all(
        days.map(async (day) => {
          try {
            const info = await getAccommodationForDay(destinationId, day.dayNumber);
            return {
              dayNumber: day.dayNumber,
              name: info.accommodation?.name || null,
              latitude: info.start_location?.lat || info.start_location?.latitude || null,
              longitude: info.start_location?.lon || info.start_location?.longitude || null,
            };
          } catch {
            return { dayNumber: day.dayNumber, name: null, latitude: null, longitude: null };
          }
        })
      ).then((results) => {
        const byDay = {};
        results.forEach(r => { byDay[r.dayNumber] = r; });
        setAccommodationsByDay(byDay);
        setIsLoadingAccom(false);
      });
    }
  }, [isOpen, destinationId, days, getAccommodationForDay]);

  // Build locations array for matrix request
  const buildLocationsArray = useCallback((pois, accomsByDay) => {
    const locations = [];

    // Add POIs
    pois.forEach(poi => {
      if (poi.latitude && poi.longitude) {
        locations.push({
          id: `poi_${poi.id}`,
          lat: poi.latitude,
          lon: poi.longitude,
          type: 'poi',
        });
      }
    });

    // Add accommodations
    Object.values(accomsByDay).forEach(accom => {
      if (accom.latitude && accom.longitude) {
        locations.push({
          id: `accom_${accom.dayNumber}`,
          lat: accom.latitude,
          lon: accom.longitude,
          type: 'accommodation',
        });
      }
    });

    return locations;
  }, []);

  // Get POIs to schedule based on toggle
  const poisToSchedule = useMemo(() => {
    if (includeScheduled) {
      return allPOIs;
    }
    return unscheduled;
  }, [includeScheduled, allPOIs, unscheduled]);

  // Fetch matrix for transport mode
  const fetchMatrixForMode = useCallback(async (mode) => {
    const modeConfig = TRANSPORT_MODES.find(m => m.id === mode);
    const orsProfile = modeConfig?.orsProfile || 'foot-walking';

    // Check cache first (use ORS profile as key since transit reuses driving)
    if (matrixCache[orsProfile]) {
      return;
    }

    // Skip if no POIs or no destination
    if (poisToSchedule.length === 0 || !destinationId) {
      return;
    }

    setIsLoadingMatrix(true);
    setLoadingMode(mode);
    setMatrixError(null);

    try {
      const locations = buildLocationsArray(poisToSchedule, accommodationsByDay);

      if (locations.length < 2) {
        // Not enough locations for matrix
        setIsLoadingMatrix(false);
        setLoadingMode(null);
        return;
      }

      const matrix = await fetchTravelMatrix(destinationId, locations, orsProfile);
      setMatrixCache(prev => ({ ...prev, [orsProfile]: matrix }));
    } catch (err) {
      console.error('Failed to fetch travel matrix:', err);
      setMatrixError(err.message || 'Failed to fetch travel times');
    } finally {
      setIsLoadingMatrix(false);
      setLoadingMode(null);
    }
  }, [destinationId, poisToSchedule, accommodationsByDay, matrixCache, buildLocationsArray, fetchTravelMatrix]);

  // Fetch matrix when modal opens or mode changes
  useEffect(() => {
    if (isOpen && poisToSchedule.length > 0 && destinationId && Object.keys(accommodationsByDay).length > 0) {
      fetchMatrixForMode(transportMode);
    }
  }, [isOpen, transportMode, poisToSchedule.length, destinationId, accommodationsByDay, fetchMatrixForMode]);

  // Get effective matrix for current transport mode (applies multiplier for transit)
  const getEffectiveMatrix = useCallback((mode) => {
    const modeConfig = TRANSPORT_MODES.find(m => m.id === mode);
    const baseMatrix = matrixCache[modeConfig?.orsProfile || 'foot-walking'];

    if (!baseMatrix) return null;
    if (!modeConfig?.multiplier) return baseMatrix;

    // Apply multiplier for transit estimation
    return {
      ...baseMatrix,
      durations: Object.fromEntries(
        Object.entries(baseMatrix.durations).map(([from, tos]) => [
          from,
          Object.fromEntries(
            Object.entries(tos).map(([to, dur]) => [to, dur * modeConfig.multiplier])
          )
        ])
      )
    };
  }, [matrixCache]);

  // Handle transport mode change
  const handleTransportModeChange = useCallback((mode) => {
    setTransportMode(mode);
  }, []);

  // Generate schedule with current constraints
  const constraints = useMemo(() => ({
    maxFoodPerDay,
    maxHoursPerDay: noTimeLimit ? 24 : maxHoursPerDay, // 24h = effectively no limit
  }), [maxFoodPerDay, maxHoursPerDay, noTimeLimit]);

  const effectiveMatrix = useMemo(() => {
    return getEffectiveMatrix(transportMode);
  }, [getEffectiveMatrix, transportMode]);

  const scheduleResult = useMemo(() => {
    const modeConfig = TRANSPORT_MODES.find(m => m.id === transportMode);
    const profile = modeConfig?.orsProfile || 'foot-walking';
    return generateSmartSchedule(
      poisToSchedule,
      days,
      constraints,
      accommodationsByDay,
      effectiveMatrix,
      profile
    );
  }, [poisToSchedule, days, constraints, accommodationsByDay, effectiveMatrix, transportMode]);

  const schedulePreview = useMemo(() => {
    const modeConfig = TRANSPORT_MODES.find(m => m.id === transportMode);
    const profile = modeConfig?.orsProfile || 'foot-walking';
    return getSchedulePreview(
      scheduleResult.schedule,
      days,
      constraints,
      accommodationsByDay,
      effectiveMatrix,
      profile
    );
  }, [scheduleResult.schedule, days, constraints, accommodationsByDay, effectiveMatrix, transportMode]);

  // Count days without accommodation
  const daysWithoutAccommodation = useMemo(() => {
    return schedulePreview.filter(day =>
      day.warnings?.some(w => w.type === 'no_accommodation') ||
      day.warningsLegacy?.noAccommodation
    );
  }, [schedulePreview]);

  // Toggle day expansion
  const toggleDay = useCallback((date) => {
    setExpandedDays(prev => ({
      ...prev,
      [date]: !prev[date],
    }));
  }, []);

  // Handle apply
  const handleApply = useCallback(() => {
    onApply(scheduleResult.assignments, optimizeRoutes);
  }, [onApply, scheduleResult.assignments, optimizeRoutes]);

  if (!isOpen) return null;

  const { stats, warnings: scheduleWarnings } = scheduleResult;
  const hasChanges = stats.distributedPOIs > 0;
  const hasMatrix = !!effectiveMatrix;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop bg-black/40 p-4">
      <div className="modal-content bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
        {/* Header */}
        <div className="modal-header flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="modal-icon-container w-11 h-11 rounded-xl bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/40 dark:to-indigo-900/40 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Smart Day Planner
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Auto-distribute POIs across {days.length} days
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isApplying}
            className="modal-close-btn p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Configuration Panel */}
        <div className="px-6 py-4 bg-gray-50/70 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 space-y-4">
          {/* Transport Mode Selector */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              Travel Mode
            </label>
            <TransportModeSelector
              selectedMode={transportMode}
              onModeChange={handleTransportModeChange}
              isLoading={isLoadingMatrix}
              loadingMode={loadingMode}
            />
            {transportMode === 'public-transit' && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
                Estimated as 1.5x driving time (ORS doesn't support transit)
              </p>
            )}
          </div>

          {/* Include Scheduled Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Include already scheduled POIs
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Re-schedule all POIs, not just unscheduled ones
              </p>
            </div>
            <button
              onClick={() => setIncludeScheduled(!includeScheduled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                includeScheduled
                  ? 'bg-indigo-600'
                  : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                  includeScheduled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Constraint Sliders */}
          <div className="grid grid-cols-2 gap-4">
            {/* Max Restaurants Per Day */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <UtensilsCrossed className="w-3.5 h-3.5 text-orange-500" />
                  Max restaurants/day
                </label>
                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                  {maxFoodPerDay}
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="4"
                value={maxFoodPerDay}
                onChange={(e) => setMaxFoodPerDay(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-indigo-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>1</span>
                <span>4</span>
              </div>
            </div>

            {/* Max Hours Per Day */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-500" />
                  Max hours/day
                </label>
                <div className="flex items-center gap-2">
                  {noTimeLimit ? (
                    <span className="text-sm font-bold text-green-600 dark:text-green-400 flex items-center gap-1">
                      <Infinity className="w-4 h-4" />
                      No limit
                    </span>
                  ) : (
                    <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                      {maxHoursPerDay}h
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="4"
                  max="12"
                  value={maxHoursPerDay}
                  onChange={(e) => setMaxHoursPerDay(Number(e.target.value))}
                  disabled={noTimeLimit}
                  className={`flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-indigo-600 ${noTimeLimit ? 'opacity-40' : ''}`}
                />
                <button
                  onClick={() => setNoTimeLimit(!noTimeLimit)}
                  className={`px-2 py-1 text-xs font-medium rounded-lg transition-colors ${
                    noTimeLimit
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 ring-1 ring-green-300 dark:ring-green-700'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                  title="Disable time budget limit"
                >
                  <Infinity className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>4h</span>
                <span>12h</span>
              </div>
            </div>
          </div>

          {/* Route Optimization Toggle */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <Route className="w-4 h-4 text-indigo-500" />
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Optimize routes after scheduling
              </label>
            </div>
            <button
              onClick={() => setOptimizeRoutes(!optimizeRoutes)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                optimizeRoutes
                  ? 'bg-indigo-600'
                  : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                  optimizeRoutes ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Preview Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {/* Loading matrix indicator */}
          {isLoadingMatrix && (
            <div className="flex items-center gap-2 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg mb-2">
              <Loader2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 animate-spin" />
              <span className="text-sm text-indigo-700 dark:text-indigo-300">
                Calculating travel times for {TRANSPORT_MODES.find(m => m.id === loadingMode)?.label || 'selected mode'}...
              </span>
            </div>
          )}

          {/* Matrix error */}
          {matrixError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg mb-2">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
              <span className="text-sm text-red-700 dark:text-red-300">
                {matrixError}. Using estimated travel times.
              </span>
            </div>
          )}

          {/* Fallback notice */}
          {!isLoadingMatrix && !matrixError && effectiveMatrix?.fallback_used && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <span className="text-sm text-amber-700 dark:text-amber-300">
                Using estimated travel times (ORS API unavailable).
              </span>
            </div>
          )}

          {/* Loading accommodations indicator */}
          {isLoadingAccom && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg mb-2">
              <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin" />
              <span className="text-sm text-blue-700 dark:text-blue-300">
                Loading accommodation info...
              </span>
            </div>
          )}

          {/* Schedule-level warnings (saturation warnings) */}
          {scheduleWarnings && scheduleWarnings.length > 0 && (() => {
            // Filter out time warnings when no time limit is set
            const filteredWarnings = noTimeLimit
              ? scheduleWarnings.filter(w => w.type !== 'time_exceeded' && w.type !== 'time_near_limit')
              : scheduleWarnings;

            const errorWarnings = filteredWarnings.filter(w => w.severity === 'error');
            const warningWarnings = filteredWarnings.filter(w => w.severity === 'warning');

            return (
              <>
                {/* Error-level warnings */}
                {errorWarnings.length > 0 && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg mb-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-300 mb-1">
                      <AlertTriangle className="w-4 h-4" />
                      {noTimeLimit ? 'Food Budget Exceeded' : 'Time/Food Budget Exceeded'}
                    </div>
                    <div className="space-y-0.5">
                      {errorWarnings.map((warning, idx) => (
                        <div key={idx} className="text-xs text-red-600 dark:text-red-400 ml-6 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                          {warning.message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Warning-level warnings (distribution issues) */}
                {warningWarnings.length > 0 && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg mb-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300 mb-1">
                      <AlertTriangle className="w-4 h-4" />
                      Distribution Warnings
                    </div>
                    <div className="space-y-0.5">
                      {warningWarnings.map((warning, idx) => (
                        <div key={idx} className="text-xs text-amber-600 dark:text-amber-400 ml-6 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                          {warning.message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            );
          })()}

          {/* Warning banner for days without accommodation */}
          {!isLoadingAccom && daysWithoutAccommodation.length > 0 && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <span className="text-sm text-amber-700 dark:text-amber-300">
                {daysWithoutAccommodation.length} day{daysWithoutAccommodation.length !== 1 ? 's have' : ' has'} no accommodation set.
                Routes will start from city center.
              </span>
            </div>
          )}

          {poisToSchedule.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
              <MapPin className="w-10 h-10 mb-3 opacity-50" />
              <p className="font-medium">No POIs to schedule</p>
              <p className="text-sm mt-1">Add some POIs first, or toggle to include scheduled ones</p>
            </div>
          ) : (
            schedulePreview.map((dayPreview) => (
              <DayPreviewCard
                key={dayPreview.date}
                dayPreview={dayPreview}
                isExpanded={expandedDays[dayPreview.date] !== false}
                onToggle={() => toggleDay(dayPreview.date)}
                showTravelTime={hasMatrix}
                noTimeLimit={noTimeLimit}
              />
            ))
          )}
        </div>

        {/* Summary Stats */}
        {hasChanges && (
          <div className="px-6 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-center gap-6 text-sm">
              <span className="text-gray-600 dark:text-gray-300">
                <span className="font-bold text-indigo-600 dark:text-indigo-400">{stats.distributedPOIs}</span> POIs across{' '}
                <span className="font-bold text-indigo-600 dark:text-indigo-400">{stats.daysUsed}</span> days
              </span>
              {stats.anchoredCount > 0 && (
                <>
                  <span className="text-gray-400 dark:text-gray-500">•</span>
                  <span className="text-gray-600 dark:text-gray-300 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5" />
                    <span className="font-bold text-amber-600 dark:text-amber-400">{stats.anchoredCount}</span> anchored
                  </span>
                </>
              )}
              <span className="text-gray-400 dark:text-gray-500">•</span>
              <span className="text-gray-600 dark:text-gray-300">
                Avg <span className="font-bold text-indigo-600 dark:text-indigo-400">{stats.avgHoursPerDay}h</span>/day
              </span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <button
            onClick={onClose}
            disabled={isApplying}
            className="modal-btn modal-btn-secondary px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={isApplying || !hasChanges}
            className="modal-btn modal-btn-primary flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed shadow-sm hover:shadow-md transition-all"
          >
            {isApplying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Applying...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Apply Schedule</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SmartSchedulerModal;
