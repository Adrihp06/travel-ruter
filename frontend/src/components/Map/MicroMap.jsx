import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import Map, {
  NavigationControl,
  FullscreenControl,
  Marker,
  Popup,
  Source,
  Layer,
} from 'react-map-gl';
import useSupercluster from 'use-supercluster';
import {
  MapPin,
  Bed,
  Utensils,
  Landmark,
  ShoppingBag,
  Music,
  Dumbbell,
  Plus,
  DollarSign,
  ThumbsUp,
  ThumbsDown,
  Footprints,
  Route,
  Calendar,
  Eye,
  EyeOff,
  ChevronUp,
  Layers,
  GripVertical,
  Info,
} from 'lucide-react';
import XIcon from '@/components/icons/x-icon';
import ClockIcon from '@/components/icons/clock-icon';
import CameraIcon from '@/components/icons/camera-icon';
import PenIcon from '@/components/icons/pen-icon';
import TrashIcon from '@/components/icons/trash-icon';
import ExternalLinkIcon from '@/components/icons/external-link-icon';
import DownChevron from '@/components/icons/down-chevron';
import StarIcon from '@/components/icons/star-icon';
import MagnifierIcon from '@/components/icons/magnifier-icon';
import { useMapboxToken } from '../../contexts/MapboxContext';
import useDayRoutesStore from '../../stores/useDayRoutesStore';
import RouteInfoBar from '../Routes/RouteInfoBar';
import QuickPOISearch from './QuickPOISearch';
import {
  getCategoryColors,
  getDayRouteColor,
  getClusterSize,
  BRAND_COLORS,
  DAY_ROUTE_COLORS,
  MARKER_STYLES,
  ROUTE_STYLES,
  LEGEND_STYLES,
} from './mapStyles';
import 'mapbox-gl/dist/mapbox-gl.css';
import './mapStyles.css';

/**
 * Get icon component for a POI category
 * Returns the icon component itself, not creating a new one during render
 */
const getCategoryIconComponent = (category) => {
  const normalizedCategory = category?.toLowerCase() || '';

  if (normalizedCategory.includes('accommodation') || normalizedCategory.includes('hotel') || normalizedCategory.includes('stay')) {
    return Bed;
  }
  if (normalizedCategory.includes('food') || normalizedCategory.includes('restaurant') || normalizedCategory.includes('dining') || normalizedCategory.includes('cafe')) {
    return Utensils;
  }
  if (normalizedCategory.includes('sight') || normalizedCategory.includes('attraction') || normalizedCategory.includes('landmark') || normalizedCategory.includes('monument')) {
    return CameraIcon;
  }
  if (normalizedCategory.includes('museum') || normalizedCategory.includes('gallery') || normalizedCategory.includes('historic')) {
    return Landmark;
  }
  if (normalizedCategory.includes('shop') || normalizedCategory.includes('market') || normalizedCategory.includes('store')) {
    return ShoppingBag;
  }
  if (normalizedCategory.includes('entertainment') || normalizedCategory.includes('nightlife') || normalizedCategory.includes('bar')) {
    return Music;
  }
  if (normalizedCategory.includes('sport') || normalizedCategory.includes('activity') || normalizedCategory.includes('outdoor')) {
    return Dumbbell;
  }

  return MapPin;
};

// getCategoryColors is now imported from ./mapStyles.js

/**
 * Extract coordinates from various POI/destination formats
 */
const getCoordinates = (item) => {
  if (!item) return null;

  if (item.latitude !== undefined && item.longitude !== undefined) {
    return { lat: item.latitude, lng: item.longitude };
  }
  if (item.lat !== undefined && item.lng !== undefined) {
    return { lat: item.lat, lng: item.lng };
  }
  if (item.coordinates) {
    if (item.coordinates.type === 'Point') {
      return {
        lat: item.coordinates.coordinates[1],
        lng: item.coordinates.coordinates[0],
      };
    }
    if (Array.isArray(item.coordinates)) {
      return {
        lat: item.coordinates[1],
        lng: item.coordinates[0],
      };
    }
  }
  return null;
};

/**
 * Render category icon inline
 */
const renderCategoryIcon = (category, className = "w-4 h-4") => {
  const Icon = getCategoryIconComponent(category);
  return <Icon className={className} />;
};

// Use DAY_ROUTE_COLORS from mapStyles.js (imported above)
const DAY_COLORS = DAY_ROUTE_COLORS;

// Get route layer style for a specific day
const getDayRouteLayerStyle = (dayIndex, layerId) => ({
  id: layerId,
  type: 'line',
  layout: {
    'line-join': 'round',
    'line-cap': 'round',
  },
  paint: {
    'line-color': DAY_COLORS[dayIndex % DAY_COLORS.length].stroke,
    'line-width': 4,
    'line-opacity': 0.85,
  },
});

// Route outline for visibility
const getDayRouteOutlineStyle = (layerId) => ({
  id: layerId,
  type: 'line',
  layout: {
    'line-join': 'round',
    'line-cap': 'round',
  },
  paint: {
    'line-color': '#ffffff',
    'line-width': 6,
    'line-opacity': 0.5,
  },
});

// Format duration
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
 * Cluster Marker Component - Enhanced visuals with gradient and glow effect
 */
const ClusterMarker = ({ cluster, pointCount, onClick, supercluster }) => {
  // Get the leaves (POIs) in this cluster to determine dominant category
  const leaves = supercluster.getLeaves(cluster.id, Infinity);
  const categoryCount = {};
  leaves.forEach(leaf => {
    const cat = leaf.properties.category || 'other';
    categoryCount[cat] = (categoryCount[cat] || 0) + 1;
  });

  // Find dominant category
  const dominantCategory = Object.entries(categoryCount)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'other';

  const colors = getCategoryColors(dominantCategory);

  // Size based on point count - using centralized config
  const size = getClusterSize(pointCount);

  // Determine size class for styling
  const sizeClass = pointCount > 20
    ? 'cluster-marker-large'
    : pointCount > 8
      ? 'cluster-marker-medium'
      : 'cluster-marker-small';

  return (
    <Marker
      longitude={cluster.geometry.coordinates[0]}
      latitude={cluster.geometry.coordinates[1]}
      anchor="center"
      onClick={(e) => {
        e.originalEvent.stopPropagation();
        onClick(cluster);
      }}
    >
      <div
        className={`cluster-marker map-cluster ${sizeClass}`}
        style={{
          width: size,
          height: size,
          background: `linear-gradient(135deg, ${colors.hex} 0%, ${colors.hex}dd 100%)`,
          boxShadow: `0 4px 16px ${colors.hex}40, 0 2px 6px rgba(0, 0, 0, 0.15)`,
        }}
      >
        <span className="font-display">{pointCount}</span>
      </div>
    </Marker>
  );
};

/**
 * POI Hover Preview Card - Enhanced styling with better typography
 */
const POIHoverPreview = ({ poi, position, onSchedule, onEdit }) => {
  const colors = getCategoryColors(poi.category);

  return (
    <div
      className="absolute z-20 pointer-events-none"
      style={{
        left: position.x,
        top: position.y - 130,
        transform: 'translateX(-50%)',
      }}
    >
      <div className="poi-hover-preview pointer-events-auto">
        {/* Header with icon and name */}
        <div className="poi-hover-preview-header">
          <div
            className="poi-hover-preview-icon text-white"
            style={{ backgroundColor: colors.hex }}
          >
            {renderCategoryIcon(poi.category, "w-3.5 h-3.5")}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="poi-hover-preview-title truncate">{poi.name}</h4>
            <span
              className="poi-hover-preview-category"
              style={{ color: colors.hex }}
            >
              {poi.category}
            </span>
          </div>
        </div>

        {/* Quick info with better spacing */}
        <div className="poi-hover-preview-meta">
          {poi.dwell_time && (
            <span className="flex items-center gap-1">
              <ClockIcon className="w-3 h-3" />
              {poi.dwell_time}m
            </span>
          )}
          {poi.scheduled_day && (
            <span className="flex items-center gap-1 text-amber-600 font-semibold">
              <Calendar className="w-3 h-3" />
              Day {poi.scheduled_day}
            </span>
          )}
        </div>

        {/* Quick action buttons - improved styling */}
        <div className="poi-hover-preview-actions">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSchedule && onSchedule(poi);
            }}
            className="poi-hover-preview-btn poi-hover-preview-btn-primary"
          >
            <Calendar className="w-3 h-3" />
            Schedule
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit && onEdit(poi);
            }}
            className="poi-hover-preview-btn poi-hover-preview-btn-secondary"
          >
            <PenIcon className="w-3 h-3" />
          </button>
        </div>

        {/* Arrow pointing down */}
        <div className="poi-hover-preview-arrow" />
      </div>
    </div>
  );
};

/**
 * POI Marker Component with enhanced visuals and gradient effects
 */
const POIMarker = ({
  poi,
  isHovered,
  isSelected,
  isHighlighted,
  onClick,
  onHover,
  onLeave,
  onDragStart,
  onDrag,
  onDragEnd,
  dayNumber,
  isDraggable = false,
}) => {
  const colors = getCategoryColors(poi.category);
  const showHighlight = isHovered || isSelected;
  const isScheduled = poi.scheduled_day || dayNumber;

  // Different marker shape for scheduled vs unscheduled
  const markerShape = isScheduled
    ? MARKER_STYLES.poi.scheduled.shape
    : MARKER_STYLES.poi.unscheduled.shape;

  const markerBorder = isScheduled
    ? MARKER_STYLES.poi.scheduled.border
    : MARKER_STYLES.poi.unscheduled.border;

  const markerShadow = isScheduled
    ? MARKER_STYLES.poi.scheduled.shadow
    : MARKER_STYLES.poi.unscheduled.shadow;

  return (
    <Marker
      longitude={poi.lng}
      latitude={poi.lat}
      anchor="bottom"
      draggable={isDraggable}
      onDragStart={onDragStart}
      onDrag={onDrag}
      onDragEnd={onDragEnd}
      onClick={(e) => {
        e.originalEvent.stopPropagation();
        onClick(poi);
      }}
    >
      <div
        className={`
          cursor-pointer transition-all duration-200 map-marker poi-marker
          ${isScheduled ? '' : 'poi-marker-unscheduled'}
          ${showHighlight ? 'scale-125 z-10' : 'scale-100'}
          ${isDraggable ? 'cursor-grab active:cursor-grabbing' : ''}
        `}
        onMouseEnter={() => onHover(poi)}
        onMouseLeave={onLeave}
      >
        <div
          className={`
            poi-marker-icon
            text-white p-2 ${markerShape} ${markerBorder} ${markerShadow}
            transition-all duration-200 relative
            ${isSelected ? 'ring-4 ring-amber-400/75 map-marker-selected' : ''}
          `}
          style={{
            background: showHighlight
              ? `linear-gradient(135deg, ${colors.hex} 0%, ${colors.hex}cc 100%)`
              : colors.hex,
            boxShadow: showHighlight
              ? `0 6px 20px ${colors.hex}50, 0 3px 8px rgba(0, 0, 0, 0.15)`
              : undefined,
          }}
        >
          {/* Day number badge for scheduled POIs - enhanced styling */}
          {dayNumber && (
            <div className="poi-marker-day-badge">
              <span>{dayNumber}</span>
            </div>
          )}

          {/* Priority indicator */}
          {poi.priority > 0 && (
            <div className="poi-marker-priority">
              <StarIcon className="w-3 h-3 fill-current" />
            </div>
          )}

          {renderCategoryIcon(poi.category, "w-4 h-4")}

          {/* Drag handle indicator when draggable */}
          {isDraggable && (
            <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 translate-y-full">
              <GripVertical className="w-3 h-3 text-stone-400" />
            </div>
          )}

          {/* Highlight circle when POI is selected from itinerary */}
          {isHighlighted && <div className="poi-highlight-circle" />}
        </div>
      </div>
    </Marker>
  );
};

/**
 * Add POI Mode Overlay - Enhanced Warm Explorer theme
 */
const AddPOIModeOverlay = ({ onCancel }) => (
  <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
    <div className="add-mode-overlay">
      <Plus className="w-4 h-4" />
      <span>Click on the map to add a POI</span>
      <button
        onClick={onCancel}
        className="add-mode-overlay-close"
      >
        <XIcon className="w-4 h-4" />
      </button>
    </div>
  </div>
);

/**
 * POI Popup Content - Enhanced with better typography and spacing
 */
const POIPopupContent = ({ poi, onVote, onEdit, onDelete }) => {
  const colors = getCategoryColors(poi.category);
  const score = (poi.likes || 0) - (poi.vetoes || 0);

  return (
    <div className="p-4 pr-10 min-w-[220px] max-w-[300px]">
      {/* Header with category icon */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-white"
            style={{ backgroundColor: colors.hex }}
          >
            {renderCategoryIcon(poi.category, "w-4 h-4")}
          </div>
          <div className="min-w-0">
            <h4 className="font-display font-bold text-stone-900 dark:text-stone-100 text-sm leading-tight">
              {poi.name}
            </h4>
            <span
              className="text-xs font-semibold"
              style={{ color: colors.hex }}
            >
              {poi.category}
            </span>
          </div>
        </div>
        {/* Score badge with improved styling */}
        <div
          className={`
            px-2.5 py-1 rounded-lg text-xs font-bold flex-shrink-0
            ${score > 5 ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' :
              score < 0 ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300' :
              'bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300'}
          `}
        >
          {score > 0 ? '+' : ''}{score}
        </div>
      </div>

      {/* Priority indicator */}
      {poi.priority > 0 && (
        <div className="flex items-center gap-1.5 mb-3 px-2.5 py-1.5 bg-amber-50 dark:bg-amber-900/30 rounded-lg w-fit">
          <StarIcon className="w-3.5 h-3.5 text-amber-500 fill-current" />
          <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
            Priority {poi.priority}
          </span>
        </div>
      )}

      {/* Description */}
      {poi.description && (
        <p className="text-xs text-stone-600 dark:text-stone-400 mb-3 line-clamp-2 leading-relaxed">
          {poi.description}
        </p>
      )}

      {/* Details with improved icons */}
      <div className="space-y-2 text-xs text-stone-500 dark:text-stone-400 mb-4">
        {poi.dwell_time && (
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-stone-100 dark:bg-stone-700 flex items-center justify-center">
              <ClockIcon className="w-3 h-3 text-stone-500 dark:text-stone-400" />
            </div>
            <span className="font-medium">{poi.dwell_time} min</span>
          </div>
        )}
        {(poi.estimated_cost || poi.actual_cost) && (
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-stone-100 dark:bg-stone-700 flex items-center justify-center">
              <DollarSign className="w-3 h-3 text-stone-500 dark:text-stone-400" />
            </div>
            <span className="font-medium">
              {poi.actual_cost ? `${poi.actual_cost} ${poi.currency || 'USD'}` :
               poi.estimated_cost ? `~${poi.estimated_cost} ${poi.currency || 'USD'}` : null}
            </span>
          </div>
        )}
        {poi.address && (
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 rounded-md bg-stone-100 dark:bg-stone-700 flex items-center justify-center flex-shrink-0 mt-0.5">
              <MapPin className="w-3 h-3 text-stone-500 dark:text-stone-400" />
            </div>
            <span className="line-clamp-2 leading-relaxed">{poi.address}</span>
          </div>
        )}
      </div>

      {/* Action buttons with better styling */}
      <div className="pt-3 border-t border-stone-100 dark:border-stone-700 flex items-center justify-between">
        {/* Voting buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onVote && onVote(poi.id, 'like')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 text-green-700 dark:text-green-300 rounded-lg transition-colors"
            title="Like this POI"
          >
            <ThumbsUp className="w-3 h-3" />
            {poi.likes || 0}
          </button>
          <button
            onClick={() => onVote && onVote(poi.id, 'veto')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold bg-rose-50 dark:bg-rose-900/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 rounded-lg transition-colors"
            title="Veto this POI"
          >
            <ThumbsDown className="w-3 h-3" />
            {poi.vetoes || 0}
          </button>
        </div>
        {/* Edit/Delete buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit && onEdit(poi)}
            className="p-2 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-lg transition-colors"
            title="Edit POI"
          >
            <PenIcon className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400" />
          </button>
          <button
            onClick={() => onDelete && onDelete(poi)}
            className="p-2 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
            title="Delete POI"
          >
            <TrashIcon className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Context Menu for marker right-click - Enhanced styling
 */
const MarkerContextMenu = ({ poi, position, onClose, onSchedule, onEdit, onDelete, onCenterMap }) => {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="map-context-menu"
      style={{ left: position.x, top: position.y, position: 'absolute', zIndex: 30 }}
    >
      <button
        onClick={() => { onCenterMap(poi); onClose(); }}
        className="map-context-menu-item"
      >
        <MapPin className="map-context-menu-icon" />
        <span>Center on map</span>
      </button>
      <button
        onClick={() => { onSchedule(poi); onClose(); }}
        className="map-context-menu-item"
      >
        <Calendar className="map-context-menu-icon" />
        <span>Schedule</span>
      </button>
      <button
        onClick={() => { onEdit(poi); onClose(); }}
        className="map-context-menu-item"
      >
        <PenIcon className="map-context-menu-icon" />
        <span>Edit</span>
      </button>
      <div className="map-context-menu-divider" />
      <button
        onClick={() => { onDelete(poi); onClose(); }}
        className="map-context-menu-item danger"
      >
        <TrashIcon className="map-context-menu-icon" />
        <span>Delete</span>
      </button>
    </div>
  );
};

/**
 * Enhanced Legend Component with better styling and animations
 */
const MapLegend = ({
  categories,
  accommodationCount = 0,
  visibleCategories,
  onToggleCategory,
  showAccommodations,
  onToggleAccommodations,
  className = "bottom-8 left-3",
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if ((!categories || categories.length === 0) && accommodationCount === 0) return null;

  return (
    <div className={`absolute z-10 map-legend ${className}`}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="map-legend-header w-full"
      >
        <div className="map-legend-title">
          <Layers className="w-4 h-4" />
          <span>Legend</span>
        </div>
        {isExpanded ? (
          <DownChevron className="w-4 h-4 text-stone-400 transition-transform" />
        ) : (
          <ChevronUp className="w-4 h-4 text-stone-400 transition-transform" />
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="map-legend-content space-y-1">
          {/* Accommodation toggle */}
          {accommodationCount > 0 && (
            <button
              onClick={() => onToggleAccommodations && onToggleAccommodations()}
              className={`map-legend-item w-full ${!showAccommodations ? 'inactive' : ''}`}
            >
              <div
                className="map-legend-icon text-white"
                style={{
                  backgroundColor: showAccommodations ? '#0284C7' : '#a8a29e',
                }}
              >
                <Bed className="w-3 h-3" />
              </div>
              <span className="map-legend-label flex-1 text-left">
                Accommodations
                <span className="ml-1 text-stone-400">({accommodationCount})</span>
              </span>
              {showAccommodations ? (
                <Eye className="map-legend-toggle text-sky-500" />
              ) : (
                <EyeOff className="map-legend-toggle" />
              )}
            </button>
          )}

          {/* Category toggles */}
          {categories.map((category) => {
            const colors = getCategoryColors(category);
            const isVisible = !visibleCategories || visibleCategories.includes(category);

            return (
              <button
                key={category}
                onClick={() => onToggleCategory && onToggleCategory(category)}
                className={`map-legend-item w-full ${!isVisible ? 'inactive' : ''}`}
              >
                <div
                  className="map-legend-icon text-white"
                  style={{
                    backgroundColor: isVisible ? colors.hex : '#a8a29e',
                  }}
                >
                  {renderCategoryIcon(category, "w-3 h-3")}
                </div>
                <span className="map-legend-label truncate flex-1 text-left">{category}</span>
                {isVisible ? (
                  <Eye className="map-legend-toggle" style={{ color: colors.hex }} />
                ) : (
                  <EyeOff className="map-legend-toggle" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

/**
 * Accommodation Marker Component
 */
const AccommodationMarker = ({ accommodation, isHovered, onClick, onHover, onLeave }) => {
  const coords = getCoordinates(accommodation);
  if (!coords) return null;

  return (
    <Marker
      longitude={coords.lng}
      latitude={coords.lat}
      anchor="bottom"
      onClick={(e) => {
        e.originalEvent.stopPropagation();
        onClick(accommodation);
      }}
    >
      <div
        className={`
          cursor-pointer transition-all duration-200
          ${isHovered ? 'scale-125 z-10' : 'scale-100'}
        `}
        onMouseEnter={() => onHover(accommodation)}
        onMouseLeave={onLeave}
      >
        <div className={`
          bg-blue-600 hover:bg-blue-700
          text-white p-2 rounded-lg shadow-lg
          transition-colors duration-200 border-2 border-white
          ${isHovered ? 'ring-4 ring-blue-400 ring-opacity-75' : ''}
        `}>
          <Bed className="w-4 h-4" />
        </div>
      </div>
    </Marker>
  );
};

/**
 * Accommodation Popup Content - Enhanced with better typography
 */
const AccommodationPopupContent = ({ accommodation, onEdit, onDelete }) => {
  const nights = (() => {
    if (accommodation.check_in_date && accommodation.check_out_date) {
      const checkIn = new Date(accommodation.check_in_date);
      const checkOut = new Date(accommodation.check_out_date);
      const diff = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
      return diff > 0 ? diff : 0;
    }
    return 0;
  })();

  const typeEmoji = {
    hotel: '🏨',
    hostel: '🛏️',
    airbnb: '🏠',
    apartment: '🏢',
    resort: '🏝️',
    camping: '⛺',
    guesthouse: '🏡',
    ryokan: '🏯',
    other: '🏘️',
  };

  return (
    <div className="p-4 pr-10 min-w-[220px] max-w-[300px]">
      {/* Header with emoji */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 bg-sky-100 dark:bg-sky-900/40 rounded-xl flex items-center justify-center flex-shrink-0">
          <span className="text-xl">{typeEmoji[accommodation.type] || typeEmoji.other}</span>
        </div>
        <div className="min-w-0">
          <h4 className="font-display font-bold text-stone-900 dark:text-stone-100 text-sm leading-tight">
            {accommodation.name}
          </h4>
          <span className="text-xs font-semibold text-sky-600 dark:text-sky-400 capitalize">{accommodation.type}</span>
        </div>
      </div>

      {/* Stay duration badge */}
      <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-sky-50 dark:bg-sky-900/30 rounded-lg">
        <Bed className="w-4 h-4 text-sky-600 dark:text-sky-400" />
        <span className="text-xs font-semibold text-sky-700 dark:text-sky-300">
          {nights} night{nights !== 1 ? 's' : ''}
        </span>
        <span className="text-xs text-sky-600 dark:text-sky-400">
          {accommodation.check_in_date} → {accommodation.check_out_date}
        </span>
      </div>

      {/* Details with improved styling */}
      <div className="space-y-2.5 text-xs text-stone-500 dark:text-stone-400 mb-4">
        {/* Cost */}
        {accommodation.total_cost && (
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-stone-100 dark:bg-stone-700 flex items-center justify-center">
              <DollarSign className="w-3 h-3 text-stone-500 dark:text-stone-400" />
            </div>
            <span className="font-semibold text-stone-700 dark:text-stone-300">
              {accommodation.total_cost} {accommodation.currency || 'USD'}
            </span>
          </div>
        )}

        {/* Address */}
        {accommodation.address && (
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 rounded-md bg-stone-100 dark:bg-stone-700 flex items-center justify-center flex-shrink-0 mt-0.5">
              <MapPin className="w-3 h-3 text-stone-500 dark:text-stone-400" />
            </div>
            <span className="line-clamp-2 leading-relaxed">{accommodation.address}</span>
          </div>
        )}

        {/* Booking Reference */}
        {accommodation.booking_reference && (
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-stone-100 dark:bg-stone-700 flex items-center justify-center">
              <span className="text-xs font-bold text-stone-400 dark:text-stone-500">#</span>
            </div>
            <span className="font-mono text-stone-600 dark:text-stone-400">{accommodation.booking_reference}</span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      {(onEdit || onDelete) && (
        <div className="pt-3 border-t border-stone-100 dark:border-stone-700 flex items-center justify-end gap-1">
          {onEdit && (
            <button
              onClick={() => onEdit(accommodation)}
              className="p-2 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-lg transition-colors"
              title="Edit accommodation"
            >
              <PenIcon className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(accommodation.id)}
              className="p-2 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
              title="Delete accommodation"
            >
              <TrashIcon className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * MicroMap - Deep zoom city map with POI markers
 *
 * Features:
 * - Deep zoom on specific city
 * - Marker clustering when zoomed out
 * - Custom icons per POI category (Bed, Fork, Camera, etc.)
 * - Hover preview cards with quick actions
 * - Visual differentiation for scheduled vs unscheduled POIs
 * - Numbered markers for day order
 * - Collapsible legend with category toggles
 * - Draggable markers for location updates
 * - Right-click context menu
 */
const MicroMap = ({
  destination,
  pois = [],
  accommodations = [],
  height = '400px',
  zoom = 14,
  className = '',
  showLegend = true,
  enableAddPOI = true,
  enableClustering = true,
  enableDragging = false,
  onAddPOI = null,
  onPOIClick = null,
  onVotePOI = null,
  onEditPOI = null,
  onDeletePOI = null,
  onSchedulePOI = null,
  onUpdatePOILocation = null,
  onEditAccommodation = null,
  onDeleteAccommodation = null,
  centerOnPOI = null,
  selectedPOIs = [],
  clearPendingTrigger = 0,
  showRouteControls = true, // Show route UI controls
  days = [], // Array of { date, displayDate, dayNumber } for route display
  poisByDay = {}, // Map of date -> POIs for that day
}) => {
  const { mapboxAccessToken } = useMapboxToken();
  const [popupInfo, setPopupInfo] = useState(null);
  const [popupType, setPopupType] = useState(null); // 'poi' or 'accommodation'
  const [hoveredPOI, setHoveredPOI] = useState(null);
  const [hoverPosition, setHoverPosition] = useState(null);
  const [hoveredAccommodation, setHoveredAccommodation] = useState(null);
  const [isAddMode, setIsAddMode] = useState(false);
  const [pendingLocation, setPendingLocation] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [visibleCategories, setVisibleCategories] = useState(null); // null = show all
  const [showAccommodations, setShowAccommodations] = useState(true);
  const [viewState, setViewState] = useState(null);
  const [bounds, setBounds] = useState(null);
  const [searchedPlace, setSearchedPlace] = useState(null);
  const [highlightedPOI, setHighlightedPOI] = useState(null);
  const mapRef = useRef(null);
  const hoverTimeoutRef = useRef(null);

  // Day routes store integration
  const {
    dayRoutes,
    visibleDays,
    toggleDayVisibility,
    calculateAllDayRoutes,
    exportDayToGoogleMaps,
    isCalculating,
    cancelPendingCalculations,
  } = useDayRoutesStore();

  // Get destination coordinates
  const destinationCoords = useMemo(() => getCoordinates(destination), [destination]);

  // Initial view state
  const initialViewState = useMemo(() => {
    if (!destinationCoords) return null;
    return {
      longitude: destinationCoords.lng,
      latitude: destinationCoords.lat,
      zoom: zoom,
    };
  }, [destinationCoords, zoom]);

  // Effect to fly to destination when it changes
  useEffect(() => {
    if (destination && mapRef.current && destinationCoords) {
      mapRef.current.flyTo({
        center: [destinationCoords.lng, destinationCoords.lat],
        zoom: zoom,
        duration: 1000,
      });
    }
  }, [destination, destinationCoords, zoom]);

  // Cleanup hover timeout on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
    };
  }, []);

  // Effect to fly to POI when centerOnPOI changes
  useEffect(() => {
    if (centerOnPOI && mapRef.current) {
      const coords = getCoordinates(centerOnPOI);
      if (coords) {
        // Fly to POI without changing zoom level
        mapRef.current.flyTo({
          center: [coords.lng, coords.lat],
          duration: 800,
        });
        // Show highlight circle for 4 seconds
        setHighlightedPOI(centerOnPOI.id);
        setTimeout(() => setHighlightedPOI(null), 4000);
        // Also open the popup for this POI
        setPopupInfo({
          ...centerOnPOI,
          ...coords,
        });
        setPopupType('poi');
      }
    }
  }, [centerOnPOI]);

  // Clear searched place when POIs change (might have added it)
  // Clear searchedPlace when a new POI is added (pois array length changes)
  // We track previous length to only clear when POIs are actually added
  const prevPoisLengthRef = useRef(pois?.length || 0);
  useEffect(() => {
    const currentLength = pois?.length || 0;
    // Only clear if pois count increased (meaning a new POI was added)
    if (currentLength > prevPoisLengthRef.current) {
      setSearchedPlace(null);
      setPopupInfo(null);
      setPopupType(null);
    }
    prevPoisLengthRef.current = currentLength;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pois?.length]);

  const handleQuickSearchSelect = useCallback((place) => {
    setSearchedPlace(place);
    setPopupInfo({
      id: 'searched-place',
      name: place.name,
      lat: place.latitude,
      lng: place.longitude,
      ...place
    });
    setPopupType('searched');
    
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [place.longitude, place.latitude],
        zoom: 16,
        duration: 800
      });
    }
  }, []);

  const mapGoogleTypeToCategory = (type) => {
    if (!type) return 'Sights';
    if (['restaurant', 'cafe', 'bar', 'bakery', 'meal_takeaway'].includes(type)) return 'Food';
    if (['lodging', 'hotel'].includes(type)) return 'Accommodation';
    if (['museum', 'art_gallery'].includes(type)) return 'Museum';
    if (['shopping_mall', 'store', 'clothing_store'].includes(type)) return 'Shopping';
    if (['amusement_park', 'aquarium', 'zoo', 'movie_theater'].includes(type)) return 'Entertainment';
    if (['park', 'gym', 'stadium'].includes(type)) return 'Activity';
    return 'Sights';
  };

  const handleAddToTrip = useCallback(() => {
    if (onAddPOI && searchedPlace) {
      onAddPOI({
        latitude: searchedPlace.latitude,
        longitude: searchedPlace.longitude,
        name: searchedPlace.name,
        address: searchedPlace.formatted_address,
        rating: searchedPlace.rating,
        google_place_id: searchedPlace.place_id,
        category: searchedPlace.types?.[0] || 'Sights',
        // Pass more data to pre-fill the modal
        preFill: {
          name: searchedPlace.name,
          address: searchedPlace.formatted_address,
          description: `Rating: ${searchedPlace.rating} (${searchedPlace.user_ratings_total} reviews)`,
          category: mapGoogleTypeToCategory(searchedPlace.types?.[0])
        }
      });
      setSearchedPlace(null);
      setPopupInfo(null);
    }
  }, [onAddPOI, searchedPlace]);

  // Clear pending location when POIs change (i.e., new POI was added)
  useEffect(() => {
    if (pendingLocation !== null) {
      setPendingLocation(null);
    }
  }, [pois, pendingLocation]);

  // Clear pending location when triggered externally (e.g., modal closed without creating POI)
  useEffect(() => {
    if (clearPendingTrigger > 0 && pendingLocation !== null) {
      setPendingLocation(null);
    }
  }, [clearPendingTrigger, pendingLocation]);

  // Calculate routes when poisByDay changes (debounced in store)
  useEffect(() => {
    if (Object.keys(poisByDay).length > 0) {
      calculateAllDayRoutes(poisByDay);
    }
    // Cleanup: cancel pending calculations on unmount
    return () => {
      cancelPendingCalculations();
    };
  }, [poisByDay, calculateAllDayRoutes, cancelPendingCalculations]);

  // Get visible routes for rendering
  const visibleRoutes = useMemo(() => {
    return visibleDays
      .map((date, index) => {
        const route = dayRoutes[date];
        // Check that route exists and has geometry with coordinates
        if (!route?.geometry?.coordinates?.length) return null;
        const dayIndex = days.findIndex(d => d.date === date);
        return {
          date,
          dayIndex: dayIndex >= 0 ? dayIndex : index,
          geometry: route.geometry,
          totalDistance: route.totalDistance,
          totalDuration: route.totalDuration,
          totalDwellTime: route.totalDwellTime,
          segments: route.segments,
          pois: route.pois,
        };
      })
      .filter(Boolean);
  }, [visibleDays, dayRoutes, days]);

  // Handle day route toggle
  const handleToggleDayRoute = useCallback((date) => {
    toggleDayVisibility(date);
  }, [toggleDayVisibility]);

  // Handle Google Maps export for a day
  const handleExportDayToGoogleMaps = useCallback(async (date) => {
    await exportDayToGoogleMaps(date);
  }, [exportDayToGoogleMaps]);

  // Extract and flatten POI markers with coordinates
  const poiMarkers = useMemo(() => {
    if (!pois || pois.length === 0) return [];

    const markers = [];
    pois.forEach((categoryGroup) => {
      if (categoryGroup.pois) {
        categoryGroup.pois.forEach((poi) => {
          const poiCoords = getCoordinates(poi);
          if (poiCoords) {
            markers.push({
              ...poi,
              ...poiCoords,
              category: categoryGroup.category || poi.category,
            });
          }
        });
      }
    });
    return markers;
  }, [pois]);

  // Build day order mapping for numbered markers
  const poiDayInfo = useMemo(() => {
    const info = {};
    Object.entries(poisByDay).forEach(([date, dayPois]) => {
      const day = days.find(d => d.date === date);
      if (day && dayPois) {
        dayPois.forEach((poi) => {
          info[poi.id] = {
            dayNumber: day.dayNumber,
          };
        });
      }
    });
    return info;
  }, [poisByDay, days]);

  // Filter markers by visible categories
  const filteredPoiMarkers = useMemo(() => {
    if (!visibleCategories) return poiMarkers;
    return poiMarkers.filter(poi => visibleCategories.includes(poi.category));
  }, [poiMarkers, visibleCategories]);

  // Convert POIs to GeoJSON for clustering
  const geoJsonPoints = useMemo(() => {
    return filteredPoiMarkers.map((poi) => ({
      type: 'Feature',
      properties: {
        cluster: false,
        poiId: poi.id,
        category: poi.category,
        name: poi.name,
        ...poi,
      },
      geometry: {
        type: 'Point',
        coordinates: [poi.lng, poi.lat],
      },
    }));
  }, [filteredPoiMarkers]);

  // Use supercluster for marker clustering
  const { clusters, supercluster } = useSupercluster({
    points: enableClustering ? geoJsonPoints : [],
    bounds: bounds || [-180, -90, 180, 90],
    zoom: viewState?.zoom || zoom,
    options: {
      radius: 35,
      maxZoom: 17,
    },
  });

  // Get unique categories for legend
  const categories = useMemo(() => {
    const cats = new Set();
    poiMarkers.forEach((poi) => {
      if (poi.category) cats.add(poi.category);
    });
    return Array.from(cats);
  }, [poiMarkers]);

  // Handle POI marker click
  const handleMarkerClick = useCallback((poi) => {
    setPopupInfo(poi);
    setPopupType('poi');
    setHoveredPOI(null);
    if (onPOIClick) {
      onPOIClick(poi);
    }
  }, [onPOIClick]);

  // Handle cluster click - zoom to expand
  const handleClusterClick = useCallback((cluster) => {
    if (!supercluster || !mapRef.current) return;

    const expansionZoom = Math.min(
      supercluster.getClusterExpansionZoom(cluster.id),
      20
    );

    mapRef.current.flyTo({
      center: cluster.geometry.coordinates,
      zoom: expansionZoom,
      duration: 500,
    });
  }, [supercluster]);

  // Handle accommodation marker click
  const handleAccommodationClick = useCallback((accommodation) => {
    const coords = getCoordinates(accommodation);
    setPopupInfo({ ...accommodation, lat: coords?.lat, lng: coords?.lng });
    setPopupType('accommodation');
  }, []);

  // Handle POI hover with delay for preview card
  const handlePOIHover = useCallback((poi, event) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }

    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredPOI(poi);
      if (event) {
        setHoverPosition({ x: event.clientX, y: event.clientY });
      }
    }, 200);
  }, []);

  const handlePOILeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setHoveredPOI(null);
    setHoverPosition(null);
  }, []);

  // Handle map click for adding POI or closing popup
  const handleMapClick = useCallback((event) => {
    // Close context menu on any click
    setContextMenu(null);

    // Close popup when clicking on the map (not on a marker)
    if (popupInfo) {
      setPopupInfo(null);
      setPopupType(null);
    }

    if (!isAddMode) return;

    const { lngLat } = event;
    setPendingLocation({
      latitude: lngLat.lat,
      longitude: lngLat.lng,
    });
    setIsAddMode(false);

    if (onAddPOI) {
      onAddPOI({
        latitude: lngLat.lat,
        longitude: lngLat.lng,
      });
    }
  }, [isAddMode, onAddPOI, popupInfo]);

  // Handle marker drag end
  const handleMarkerDragEnd = useCallback((poi, event) => {
    if (onUpdatePOILocation) {
      onUpdatePOILocation(poi.id, {
        latitude: event.lngLat.lat,
        longitude: event.lngLat.lng,
      });
    }
  }, [onUpdatePOILocation]);

  // Handle center map on POI
  const handleCenterOnPOI = useCallback((poi) => {
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [poi.lng, poi.lat],
        duration: 500,
      });
      // Show highlight circle for 4 seconds
      setHighlightedPOI(poi.id);
      setTimeout(() => setHighlightedPOI(null), 4000);
    }
  }, []);

  // Toggle add POI mode
  const toggleAddMode = useCallback(() => {
    setIsAddMode((prev) => !prev);
    setPendingLocation(null);
    setPopupInfo(null);
  }, []);

  // Toggle category visibility
  const handleToggleCategory = useCallback((category) => {
    setVisibleCategories(prev => {
      if (!prev) {
        // First toggle - show all except this one
        return categories.filter(c => c !== category);
      }
      if (prev.includes(category)) {
        // Remove this category
        const newVisible = prev.filter(c => c !== category);
        return newVisible.length === 0 ? null : newVisible;
      } else {
        // Add this category
        return [...prev, category];
      }
    });
  }, [categories]);

  // Update bounds from map for clustering
  const updateBoundsFromMap = useCallback(() => {
    if (mapRef.current) {
      const map = mapRef.current.getMap();
      if (map) {
        const mapBounds = map.getBounds();
        setBounds([
          mapBounds.getWest(),
          mapBounds.getSouth(),
          mapBounds.getEast(),
          mapBounds.getNorth(),
        ]);
      }
    }
  }, []);

  // Handle view state change for clustering
  const handleMoveEnd = useCallback((evt) => {
    setViewState(evt.viewState);
    updateBoundsFromMap();
  }, [updateBoundsFromMap]);

  // Handle map load to set initial bounds
  const handleLoad = useCallback(() => {
    updateBoundsFromMap();
  }, [updateBoundsFromMap]);

  // Error states
  if (!mapboxAccessToken) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 rounded-lg ${className}`}
        style={{ height }}
      >
        <p className="text-gray-400 text-sm">Map unavailable - Missing API key</p>
      </div>
    );
  }

  if (!destinationCoords) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 rounded-lg ${className}`}
        style={{ height }}
      >
        <p className="text-gray-400 text-sm">No location data available</p>
      </div>
    );
  }

  return (
    <div
      className={`relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 ${className}`}
      style={{ height }}
    >
      {/* Quick POI Search */}
      <div className="absolute top-[52px] right-14 z-20 w-full max-w-[280px] sm:max-w-md pointer-events-none">
        <div className="pointer-events-auto flex justify-end">
          <QuickPOISearch 
            location={destinationCoords}
            onSelect={handleQuickSearchSelect}
            initialMinimized={true}
          />
        </div>
      </div>

      {/* Add POI Mode Overlay */}
      {isAddMode && <AddPOIModeOverlay onCancel={toggleAddMode} />}

      {/* Add POI Button */}
      {enableAddPOI && onAddPOI && !isAddMode && (
        <button
          onClick={toggleAddMode}
          className="absolute top-3 right-14 z-10 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 px-3 py-1.5 rounded-lg shadow-lg flex items-center space-x-1.5 text-sm font-medium transition-colors border border-gray-200 dark:border-gray-600"
        >
          <Plus className="w-4 h-4" />
          <span>Add POI</span>
        </button>
      )}

      <Map
        ref={mapRef}
        initialViewState={initialViewState}
        onMoveEnd={handleMoveEnd}
        onLoad={handleLoad}
        mapboxAccessToken={mapboxAccessToken}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        onClick={handleMapClick}
        cursor={isAddMode ? 'crosshair' : 'grab'}
      >
        <FullscreenControl position="top-right" />
        <NavigationControl position="top-right" showCompass={true} />


        {/* Day route layers - render each visible day's route with unique color */}

        {visibleRoutes.map((route) => (
          <React.Fragment key={route.date}>
            {/* Route outline for visibility */}
            <Source
              id={`day-route-outline-${route.date}`}
              type="geojson"
              data={{
                type: 'Feature',
                properties: {},
                geometry: route.geometry,
              }}
            >
              <Layer {...getDayRouteOutlineStyle(`day-route-outline-layer-${route.date}`)} />
            </Source>

            {/* Route line with day color */}
            <Source
              id={`day-route-${route.date}`}
              type="geojson"
              data={{
                type: 'Feature',
                properties: {},
                geometry: route.geometry,
              }}
            >
              <Layer {...getDayRouteLayerStyle(route.dayIndex, `day-route-layer-${route.date}`)} />
            </Source>
          </React.Fragment>
        ))}

        {/* Searched Place Marker - Enhanced Warm Explorer theme */}
        {searchedPlace && (
          <Marker
            longitude={searchedPlace.longitude}
            latitude={searchedPlace.latitude}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setPopupInfo({
                ...searchedPlace,
                lat: searchedPlace.latitude,
                lng: searchedPlace.longitude
              });
              setPopupType('searched');
            }}
          >
            <div className="flex flex-col items-center map-marker-searched">
              <div
                className="text-white p-3 rounded-full shadow-2xl border-4 border-white"
                style={{
                  background: `linear-gradient(135deg, ${BRAND_COLORS?.primary?.[600] || '#d97706'} 0%, ${BRAND_COLORS?.primary?.[700] || '#b45309'} 100%)`,
                  boxShadow: `0 8px 24px rgba(180, 83, 9, 0.4), 0 4px 8px rgba(0, 0, 0, 0.15)`,
                }}
              >
                <MagnifierIcon className="w-5 h-5" />
              </div>
              {/* Pointer triangle */}
              <div
                className="w-0 h-0 -mt-1"
                style={{
                  borderLeft: '8px solid transparent',
                  borderRight: '8px solid transparent',
                  borderTop: `10px solid ${BRAND_COLORS?.primary?.[600] || '#d97706'}`,
                }}
              />
            </div>
          </Marker>
        )}

        {/* Render clusters or individual markers based on clustering mode */}
        {enableClustering && clusters ? (
          clusters.map((cluster) => {
            const [longitude, latitude] = cluster.geometry.coordinates;
            const { cluster: isCluster, point_count: pointCount } = cluster.properties;

            if (isCluster) {
              return (
                <ClusterMarker
                  key={`cluster-${cluster.id}`}
                  cluster={cluster}
                  pointCount={pointCount}
                  onClick={handleClusterClick}
                  supercluster={supercluster}
                />
              );
            }

            // Individual marker from cluster
            const poi = cluster.properties;
            const dayInfo = poiDayInfo[poi.poiId];

            return (
              <POIMarker
                key={poi.poiId}
                poi={{ ...poi, id: poi.poiId, lng: longitude, lat: latitude }}
                isHovered={hoveredPOI?.id === poi.poiId}
                isSelected={selectedPOIs.includes(poi.poiId)}
                isHighlighted={highlightedPOI === poi.poiId}
                onClick={() => handleMarkerClick({ ...poi, id: poi.poiId, lng: longitude, lat: latitude })}
                onHover={(p) => handlePOIHover(p)}
                onLeave={handlePOILeave}
                onDragEnd={(e) => handleMarkerDragEnd({ ...poi, id: poi.poiId }, e)}
                dayNumber={dayInfo?.dayNumber}
                isDraggable={enableDragging}
              />
            );
          })
        ) : (
          // Non-clustered markers
          filteredPoiMarkers.map((poi) => {
            const dayInfo = poiDayInfo[poi.id];

            return (
              <POIMarker
                key={poi.id}
                poi={poi}
                isHovered={hoveredPOI?.id === poi.id}
                isSelected={selectedPOIs.includes(poi.id)}
                isHighlighted={highlightedPOI === poi.id}
                onClick={handleMarkerClick}
                onHover={(p) => handlePOIHover(p)}
                onLeave={handlePOILeave}
                onDragEnd={(e) => handleMarkerDragEnd(poi, e)}
                dayNumber={dayInfo?.dayNumber}
                isDraggable={enableDragging}
              />
            );
          })
        )}

        {/* Accommodation markers */}
        {showAccommodations && accommodations.map((accommodation) => (
          <AccommodationMarker
            key={`acc-${accommodation.id}`}
            accommodation={accommodation}
            isHovered={hoveredAccommodation?.id === accommodation.id}
            onClick={handleAccommodationClick}
            onHover={setHoveredAccommodation}
            onLeave={() => setHoveredAccommodation(null)}
          />
        ))}

        {/* Pending location marker (when adding POI) */}
        {pendingLocation && (
          <Marker
            longitude={pendingLocation.longitude}
            latitude={pendingLocation.latitude}
            anchor="bottom"
          >
            <div className="flex items-center justify-center animate-bounce">
              <div className="bg-green-500 text-white p-2 rounded-full shadow-lg">
                <Plus className="w-4 h-4" />
              </div>
            </div>
          </Marker>
        )}

        {/* POI Popup */}
        {popupInfo && popupType === 'poi' && (
          <Popup
            longitude={popupInfo.lng}
            latitude={popupInfo.lat}
            anchor="bottom"
            offset={[0, -35]}
            onClose={() => { setPopupInfo(null); setPopupType(null); }}
            closeOnClick={false}
            closeButton={true}
            className="micro-map-popup"
          >
            <POIPopupContent
              poi={popupInfo}
              onVote={onVotePOI}
              onEdit={onEditPOI}
              onDelete={onDeletePOI}
            />
          </Popup>
        )}

        {/* Accommodation Popup */}
        {popupInfo && popupType === 'accommodation' && (
          <Popup
            longitude={popupInfo.lng}
            latitude={popupInfo.lat}
            anchor="bottom"
            offset={[0, -35]}
            onClose={() => { setPopupInfo(null); setPopupType(null); }}
            closeOnClick={false}
            closeButton={true}
            className="micro-map-popup"
          >
            <AccommodationPopupContent
              accommodation={popupInfo}
              onEdit={onEditAccommodation}
              onDelete={onDeleteAccommodation}
            />
          </Popup>
        )}

        {/* Searched Place Popup */}
        {popupInfo && popupType === 'searched' && (
          <Popup
            longitude={popupInfo.lng}
            latitude={popupInfo.lat}
            anchor="bottom"
            offset={[0, -45]}
            onClose={() => { 
              setPopupInfo(null); 
              setPopupType(null);
              setSearchedPlace(null);
            }}
            closeOnClick={false}
            closeButton={true}
            className="micro-map-popup"
          >
            <div className="p-3 pr-9 min-w-[220px] max-w-[300px]">
              <div className="mb-2">
                <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm leading-tight">{popupInfo.name}</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{popupInfo.formatted_address}</p>
              </div>

              <div className="flex items-center gap-3 mb-3">
                {popupInfo.rating && (
                  <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded text-[10px] font-bold">
                    <StarIcon className="w-2.5 h-2.5 fill-current" />
                    {popupInfo.rating} ({popupInfo.user_ratings_total})
                  </div>
                )}
                {popupInfo.price_level !== undefined && (
                  <div className="text-gray-400 dark:text-gray-500 text-[10px] font-bold">
                    {'$'.repeat(popupInfo.price_level)}
                  </div>
                )}
              </div>

              <button
                onClick={handleAddToTrip}
                className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-md transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-3.5 h-3.5" />
                Add to Trip
              </button>
            </div>
          </Popup>
        )}
      </Map>

      {/* Hover preview card (outside map for better positioning) */}
      {hoveredPOI && hoverPosition && !popupInfo && (
        <POIHoverPreview
          poi={hoveredPOI}
          position={hoverPosition}
          onSchedule={onSchedulePOI}
          onEdit={onEditPOI}
        />
      )}

      {/* Context menu */}
      {contextMenu && (
        <MarkerContextMenu
          poi={contextMenu.poi}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
          onSchedule={onSchedulePOI || (() => {})}
          onEdit={onEditPOI || (() => {})}
          onDelete={onDeletePOI || (() => {})}
          onCenterMap={handleCenterOnPOI}
        />
      )}

      {/* Enhanced Legend */}
      {showLegend && (
        <MapLegend
          categories={categories}
          accommodationCount={accommodations.length}
          visibleCategories={visibleCategories}
          onToggleCategory={handleToggleCategory}
          showAccommodations={showAccommodations}
          onToggleAccommodations={() => setShowAccommodations(prev => !prev)}
          className="bottom-20 left-3"
        />
      )}

      {/* Day Route Controls - shown when we have days with POIs */}
      {showRouteControls && days.length > 0 && (
        <>
          {/* Day Route Toggle Buttons - Top Left */}
          <div className="absolute top-3 left-3 z-10">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-2">
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Show routes:</div>
                <div className="group relative flex items-center">
                  <Info className="w-3.5 h-3.5 text-gray-400 cursor-help" />
                  <div className="absolute bottom-full left-0 mb-2 w-48 px-2 py-1.5 bg-gray-900/90 text-white text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 text-center backdrop-blur-sm">
                    Schedule 2+ POIs to a day to generate an optimized walking/driving route
                    <div className="absolute top-full left-3 border-4 border-transparent border-t-gray-900/90"></div>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {days.map((day, index) => {
                  const dayPois = poisByDay[day.date] || [];
                  const isVisible = visibleDays.includes(day.date);
                  const hasRoute = dayPois.length >= 2;
                  const color = DAY_COLORS[index % DAY_COLORS.length];
                  const route = dayRoutes[day.date];
                  const duration = route?.totalDuration;

                  return (
                    <button
                      key={day.date}
                      onClick={() => hasRoute && handleToggleDayRoute(day.date)}
                      disabled={!hasRoute}
                      className={`
                        px-2 py-1 rounded-md text-xs font-medium transition-all duration-200
                        flex items-center gap-1.5
                        ${hasRoute
                          ? isVisible
                            ? 'text-white shadow-sm ring-1 ring-black/5'
                            : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 shadow-sm'
                          : 'text-gray-300 dark:text-gray-600 cursor-not-allowed border border-transparent'
                        }
                      `}
                      style={hasRoute && isVisible ? { backgroundColor: color.stroke } : {}}
                      title={hasRoute ? `Day ${day.dayNumber}: ${dayPois.length} POIs${duration ? ` • ${formatDuration(duration)}` : ''}` : 'Schedule POIs to see the optimized route'}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: hasRoute ? (isVisible ? 'white' : color.stroke) : '#D1D5DB' }}
                      />
                      Day {day.dayNumber}
                      {hasRoute && duration > 0 && (
                        <span className={`text-[10px] ml-0.5 ${isVisible ? 'text-white/90' : 'text-gray-500 dark:text-gray-400'}`}>
                          ({formatDuration(duration)})
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Route Summary Bar - Bottom left, compact */}
          {visibleRoutes.length > 0 && (
            <div className="absolute bottom-3 left-3 z-10 max-w-[calc(100%-5rem)]">
              <RouteInfoBar
                distance={visibleRoutes.reduce((sum, r) => sum + r.totalDistance, 0)}
                duration={visibleRoutes.reduce((sum, r) => sum + r.totalDuration, 0)}
                isCalculating={isCalculating}
                onExportGoogleMaps={() => handleExportDayToGoogleMaps(visibleRoutes[0].date)}
                showExport={true}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default React.memo(MicroMap);
