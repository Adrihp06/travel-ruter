import React from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Footprints } from 'lucide-react';
import ExternalLinkIcon from '@/components/icons/external-link-icon';

// Format duration nicely
const formatDuration = (minutes) => {
  if (!minutes || minutes <= 0) return '';
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} hr`;
  return `${hours}h ${mins}m`;
};

// Format distance
const formatDistance = (km) => {
  if (!km || km <= 0) return '';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
};

/**
 * Shared route info bar used in both TripMap (trip-level) and MicroMap (destination-level)
 * Provides consistent visual style using .route-summary CSS class
 */
const RouteInfoBar = ({
  distance,
  duration,
  isCalculating = false,
  onExportGoogleMaps,
  showExport = true,
  children, // For extra content like SegmentNavigator
  emptyLabel,
  className = '',
}) => {
  const { t } = useTranslation();

  return (
    <div className={`route-summary ${className}`}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 min-w-0 flex-wrap">
          {/* Distance */}
          {distance > 0 && (
            <>
              <div className="route-summary-stat">
                <MapPin className="route-summary-icon" />
                <span className="route-summary-value">
                  {formatDistance(distance)}
                </span>
              </div>
              <div className="route-summary-divider hidden sm:block" />
            </>
          )}

          {/* Duration */}
          {duration > 0 && (
            <>
              <div className="route-summary-stat">
                <Footprints className="route-summary-icon" />
                <span className="route-summary-value">
                  {formatDuration(duration)}
                </span>
              </div>
              {children && <div className="route-summary-divider hidden sm:block" />}
            </>
          )}

          {/* Extra content (e.g. SegmentNavigator in TripMap) */}
          {children}

          {isCalculating && (
            <span className="text-sm text-stone-500 font-medium animate-pulse">{t('routes.calculating')}</span>
          )}

          {!distance && !duration && !isCalculating && emptyLabel && (
            <span className="text-sm text-stone-500 font-medium">
              {emptyLabel}
            </span>
          )}
        </div>

        {/* Google Maps Export Button */}
        {showExport && onExportGoogleMaps && (
          <button
            onClick={onExportGoogleMaps}
            disabled={isCalculating}
            className="google-maps-btn flex-shrink-0"
          >
            <ExternalLinkIcon className="w-4 h-4" />
            <span className="hidden sm:inline">{t('routes.googleMaps')}</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default RouteInfoBar;
