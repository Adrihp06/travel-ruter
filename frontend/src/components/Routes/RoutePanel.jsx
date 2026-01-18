import React, { useState, useCallback, useEffect } from 'react';
import {
  Route,
  Clock,
  MapPin,
  Navigation,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  X,
  Car,
  Footprints,
  Bike,
  Train,
  Plane,
} from 'lucide-react';
import RouteOptions, { RouteOptionsCompact } from './RouteOptions';
import useRouteStore from '../../stores/useRouteStore';

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
      return Plane;
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

  // Handle Google Maps export
  const handleExportToGoogleMaps = useCallback(async () => {
    if (destinations.length < 2) return;

    setIsExporting(true);
    try {
      const origin = destinations[0];
      const destination = destinations[destinations.length - 1];
      const waypoints = destinations.slice(1, -1);

      await exportToGoogleMaps(origin, destination, waypoints, transportMode);
    } finally {
      setIsExporting(false);
    }
  }, [destinations, transportMode, exportToGoogleMaps]);

  if (!isOpen) return null;

  const ModeIcon = getModeIcon(transportMode);

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Route className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Route Details</h3>
            <p className="text-xs text-gray-500">
              {destinations.length} {destinations.length === 1 ? 'stop' : 'stops'}
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        )}
      </div>

      {/* Transport Mode Selector */}
      <div className="p-4 border-b border-gray-100">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Transport Mode
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
          <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg mb-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <p className="text-sm">{error}</p>
            <button
              onClick={clearError}
              className="ml-auto p-1 hover:bg-red-100 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
            <span className="ml-2 text-sm text-gray-500">Calculating route...</span>
          </div>
        )}

        {/* Route Summary Cards */}
        {!isLoading && routeDetails && (
          <div className="space-y-4">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <MapPin className="w-4 h-4" />
                  <span className="text-xs font-medium">Distance</span>
                </div>
                <p className="text-lg font-semibold text-gray-900">
                  {formatDistance(routeDetails.distance_km || routeDetails.total_distance_km)}
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <Clock className="w-4 h-4" />
                  <span className="text-xs font-medium">Duration</span>
                </div>
                <p className="text-lg font-semibold text-gray-900">
                  {formatDuration(routeDetails.duration_min || routeDetails.total_travel_time_minutes)}
                </p>
              </div>
            </div>

            {/* Mode Indicator */}
            <div className="flex items-center gap-2 p-3 bg-indigo-50 rounded-lg">
              <ModeIcon className="w-5 h-5 text-indigo-600" />
              <span className="text-sm font-medium text-indigo-700 capitalize">
                {transportMode.replace('-', ' ')} route
              </span>
            </div>

            {/* Step-by-step Directions (for intra-city routes with legs) */}
            {routeDetails.legs && routeDetails.legs.length > 0 && (
              <div className="border-t border-gray-100 pt-4">
                <button
                  onClick={() => setShowLegs(!showLegs)}
                  className="flex items-center justify-between w-full text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  <span>Step-by-step Directions</span>
                  {showLegs ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>

                {showLegs && (
                  <div className="mt-3 space-y-2">
                    {routeDetails.legs.map((leg, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex-shrink-0 w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-bold">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900">
                            {leg.start_point?.name || `Point ${index + 1}`} →{' '}
                            {leg.end_point?.name || `Point ${index + 2}`}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatDistance(leg.distance_km)} • {formatDuration(leg.travel_time_minutes)}
                          </p>
                          {leg.description && (
                            <p className="text-xs text-gray-400 mt-1">{leg.description}</p>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Total with dwell time */}
                    {routeDetails.total_dwell_time_minutes > 0 && (
                      <div className="mt-3 p-3 bg-amber-50 rounded-lg">
                        <p className="text-sm text-amber-800">
                          <strong>Total time including stops:</strong>{' '}
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
            <Navigation className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">
              Add at least 2 destinations to see route details
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      {destinations.length >= 2 && (
        <div className="p-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={handleExportToGoogleMaps}
            disabled={isExporting || isLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ExternalLink className="w-4 h-4" />
            )}
            <span className="font-medium">Open in Google Maps</span>
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * RoutePanelCompact - Minimal route info bar
 */
export const RoutePanelCompact = ({
  destinations = [],
  onExpand,
}) => {
  const { routeDetails, transportMode, isLoading } = useRouteStore();

  if (!routeDetails || destinations.length < 2) return null;

  // Render the mode icon inline to avoid creating components during render
  const renderModeIcon = () => {
    switch (transportMode) {
      case 'walking':
        return <Footprints className="w-4 h-4 text-indigo-600" />;
      case 'cycling':
        return <Bike className="w-4 h-4 text-indigo-600" />;
      case 'train':
        return <Train className="w-4 h-4 text-indigo-600" />;
      case 'flight':
        return <Plane className="w-4 h-4 text-indigo-600" />;
      default:
        return <Car className="w-4 h-4 text-indigo-600" />;
    }
  };

  return (
    <div
      onClick={onExpand}
      className="flex items-center gap-3 p-3 bg-white rounded-lg shadow-md border border-gray-200 cursor-pointer hover:shadow-lg transition-shadow"
    >
      <div className="p-2 bg-indigo-100 rounded-lg">
        {renderModeIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm">
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
          ) : (
            <>
              <span className="font-medium text-gray-900">
                {formatDistance(routeDetails.distance_km || routeDetails.total_distance_km)}
              </span>
              <span className="text-gray-400">•</span>
              <span className="text-gray-600">
                {formatDuration(routeDetails.duration_min || routeDetails.total_travel_time_minutes)}
              </span>
            </>
          )}
        </div>
      </div>
      <ChevronUp className="w-4 h-4 text-gray-400" />
    </div>
  );
};

export default RoutePanel;
