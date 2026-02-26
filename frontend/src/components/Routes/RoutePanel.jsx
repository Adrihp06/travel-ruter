import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Route,
  MapPin,
  Navigation,
  ChevronUp,
  Loader2,
  AlertCircle,
  Car,
  Footprints,
  Bike,
  Train,
} from 'lucide-react';
import ClockIcon from '@/components/icons/clock-icon';
import ExternalLinkIcon from '@/components/icons/external-link-icon';
import DownChevron from '@/components/icons/down-chevron';
import XIcon from '@/components/icons/x-icon';
import AirplaneIcon from '@/components/icons/airplane-icon';
import RouteOptions from './RouteOptions';
import useRouteStore from '../../stores/useRouteStore';
import useTravelSegmentStore from '../../stores/useTravelSegmentStore';
import useTravelStopStore from '../../stores/useTravelStopStore';

// Format duration in human-readable format
const formatDuration = (minutes) => {
  if (!minutes || minutes <= 0) return '-';

  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);

  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} hr`;
  return `${hours} hr ${mins} min`;
};

// Format distance
const formatDistance = (km) => {
  if (!km || km <= 0) return '-';

  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
};

// Get transport mode icon
const getModeIcon = (mode) => {
  switch (mode) {
    case 'walking':
      return Footprints;
    case 'cycling':
      return Bike;
    case 'train':
      return Train;
    case 'flight':
      return AirplaneIcon;
    default:
      return Car;
  }
};

/**
 * RoutePanel component - Shows route details with options
 *
 * @param {Object} props
 * @param {Array} props.destinations - Array of destination objects
 * @param {boolean} props.isOpen - Whether the panel is open
 * @param {Function} props.onClose - Callback to close panel
 * @param {boolean} props.isInterCity - Whether this is inter-city routing
 */
const RoutePanel = ({
  destinations = [],
  isOpen = true,
  onClose,
  isInterCity = false,
}) => {
  const { t } = useTranslation();
  const {
    transportMode,
    setTransportMode,
    routeDetails,
    isLoading,
    error,
    calculateMapboxRoute,
    exportToGoogleMaps,
    clearError,
  } = useRouteStore();

  const { segments } = useTravelSegmentStore();
  const { stopsBySegment } = useTravelStopStore();

  const [showLegs, setShowLegs] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Calculate route when destinations or mode changes
  useEffect(() => {
    if (destinations.length >= 2) {
      if (isInterCity) {
        // For inter-city, use the appropriate endpoint
        calculateMapboxRoute(destinations, transportMode);
      } else {
        // For intra-city POI routing
        calculateMapboxRoute(destinations, transportMode);
      }
    }
  }, [destinations, transportMode, isInterCity, calculateMapboxRoute]);

  // Handle mode change
  const handleModeChange = useCallback((mode) => {
    setTransportMode(mode);
  }, [setTransportMode]);

  // Handle Google Maps export - includes travel stops as waypoints
  const handleExportToGoogleMaps = useCallback(async () => {
    if (destinations.length < 2) return;

    setIsExporting(true);
    try {
      const origin = destinations[0];
      const destination = destinations[destinations.length - 1];

      // Build ordered waypoints: intermediate destinations + travel stops
      const orderedWaypoints = [];
      for (let i = 0; i < destinations.length - 1; i++) {
        if (i > 0) {
          orderedWaypoints.push(destinations[i]);
        }
        const segment = segments.find(s =>
          s.from_destination_id === destinations[i].id &&
          s.to_destination_id === destinations[i + 1].id
        );
        if (segment) {
          const stops = stopsBySegment[segment.id] || [];
          stops.filter(s => s.latitude && s.longitude)
               .forEach(s => orderedWaypoints.push(s));
        }
      }

      await exportToGoogleMaps(origin, destination, orderedWaypoints, transportMode);
    } finally {
      setIsExporting(false);
    }
  }, [destinations, transportMode, exportToGoogleMaps, segments, stopsBySegment]);

  if (!isOpen) return null;

  const ModeIcon = getModeIcon(transportMode);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
            <Route className="w-5 h-5 text-[#D97706]" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">{t('routes.routeDetails')}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {destinations.length} {destinations.length === 1 ? t('routes.stop') : t('routes.stops')}
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <XIcon className="w-5 h-5 text-gray-400" />
          </button>
        )}
      </div>

      {/* Transport Mode Selector */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-700">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t('routes.transportMode')}
        </label>
        <RouteOptions
          selectedMode={transportMode}
          onModeChange={handleModeChange}
          isInterCity={isInterCity}
          disabled={isLoading || destinations.length < 2}
          size="sm"
        />
      </div>

      {/* Route Summary */}
      <div className="p-4">
        {/* Error State */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg mb-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <p className="text-sm">{error}</p>
            <button
              onClick={clearError}
              className="ml-auto p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-[#D97706] animate-spin" />
            <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">{t('routes.calculatingRoute')}</span>
          </div>
        )}

        {/* Route Summary Cards */}
        {!isLoading && routeDetails && (
          <div className="space-y-4">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                  <MapPin className="w-4 h-4" />
                  <span className="text-xs font-medium">{t('routes.distance')}</span>
                </div>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {formatDistance(routeDetails.distance_km || routeDetails.total_distance_km)}
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                  <ClockIcon className="w-4 h-4" />
                  <span className="text-xs font-medium">{t('routes.duration')}</span>
                </div>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {formatDuration(routeDetails.duration_min || routeDetails.total_travel_time_minutes)}
                </p>
              </div>
            </div>

            {/* Mode Indicator */}
            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <ModeIcon className="w-5 h-5 text-[#D97706]" />
              <span className="text-sm font-medium text-[#D97706] capitalize">
                {t('routes.modeRoute', { mode: transportMode.replace('-', ' ') })}
              </span>
            </div>

            {/* Step-by-step Directions (for intra-city routes with legs) */}
            {routeDetails.legs && routeDetails.legs.length > 0 && (
              <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
                <button
                  onClick={() => setShowLegs(!showLegs)}
                  className="flex items-center justify-between w-full text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                >
                  <span>{t('routes.stepByStepDirections')}</span>
                  {showLegs ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <DownChevron className="w-4 h-4" />
                  )}
                </button>

                {showLegs && (
                  <div className="mt-3 space-y-2">
                    {routeDetails.legs.map((leg, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <div className="flex-shrink-0 w-6 h-6 bg-amber-100 dark:bg-amber-900/30 text-[#D97706] rounded-full flex items-center justify-center text-xs font-bold">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 dark:text-white">
                            {leg.start_point?.name || `Point ${index + 1}`} →{' '}
                            {leg.end_point?.name || `Point ${index + 2}`}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDistance(leg.distance_km)} • {formatDuration(leg.travel_time_minutes)}
                          </p>
                          {leg.description && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{leg.description}</p>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Total with dwell time */}
                    {routeDetails.total_dwell_time_minutes > 0 && (
                      <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                        <p className="text-sm text-amber-800 dark:text-amber-300">
                          <strong>{t('routes.totalTimeIncludingStops')}:</strong>{' '}
                          {formatDuration(routeDetails.total_duration_minutes)}
                        </p>
                        <p className="text-xs text-amber-600 mt-1">
                          Travel: {formatDuration(routeDetails.total_travel_time_minutes)} +{' '}
                          Stops: {formatDuration(routeDetails.total_dwell_time_minutes)}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* No Route State */}
        {!isLoading && !routeDetails && destinations.length < 2 && (
          <div className="text-center py-8">
            <Navigation className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('routes.addAtLeast2Destinations')}
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      {destinations.length >= 2 && (
        <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <button
            onClick={handleExportToGoogleMaps}
            disabled={isExporting || isLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#D97706] text-white rounded-lg hover:bg-[#B45309] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ExternalLinkIcon className="w-4 h-4" />
            )}
            <span className="font-medium">{t('routes.openInGoogleMaps')}</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default RoutePanel;
