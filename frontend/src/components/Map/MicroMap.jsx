import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import Map, {
  NavigationControl,
  ScaleControl,
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
  Camera,
  Landmark,
  ShoppingBag,
  Music,
  Dumbbell,
  Plus,
  X,
  Clock,
  DollarSign,
  ThumbsUp,
  ThumbsDown,
  Pencil,
  Trash2,
  Car,
  Footprints,
  Bike,
  ExternalLink,
  Route,
  Calendar,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Layers,
  GripVertical,
} from 'lucide-react';
import { useMapboxToken } from '../../contexts/MapboxContext';
import useDayRoutesStore from '../../stores/useDayRoutesStore';
import 'mapbox-gl/dist/mapbox-gl.css';

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
    return Camera;
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

/**
 * Get marker color for a POI category
 */
const getCategoryColor = (category) => {
  const normalizedCategory = category?.toLowerCase() || '';

  if (normalizedCategory.includes('accommodation') || normalizedCategory.includes('hotel') || normalizedCategory.includes('stay')) {
    return { bg: 'bg-blue-500', hover: 'hover:bg-blue-600', text: 'text-blue-600', hex: '#3B82F6' };
  }
  if (normalizedCategory.includes('food') || normalizedCategory.includes('restaurant') || normalizedCategory.includes('dining') || normalizedCategory.includes('cafe')) {
    return { bg: 'bg-orange-500', hover: 'hover:bg-orange-600', text: 'text-orange-600', hex: '#F97316' };
  }
  if (normalizedCategory.includes('sight') || normalizedCategory.includes('attraction') || normalizedCategory.includes('landmark') || normalizedCategory.includes('monument')) {
    return { bg: 'bg-emerald-500', hover: 'hover:bg-emerald-600', text: 'text-emerald-600', hex: '#10B981' };
  }
  if (normalizedCategory.includes('museum') || normalizedCategory.includes('gallery') || normalizedCategory.includes('historic')) {
    return { bg: 'bg-purple-500', hover: 'hover:bg-purple-600', text: 'text-purple-600', hex: '#8B5CF6' };
  }
  if (normalizedCategory.includes('shop') || normalizedCategory.includes('market') || normalizedCategory.includes('store')) {
    return { bg: 'bg-pink-500', hover: 'hover:bg-pink-600', text: 'text-pink-600', hex: '#EC4899' };
  }
  if (normalizedCategory.includes('entertainment') || normalizedCategory.includes('nightlife') || normalizedCategory.includes('bar')) {
    return { bg: 'bg-violet-500', hover: 'hover:bg-violet-600', text: 'text-violet-600', hex: '#7C3AED' };
  }
  if (normalizedCategory.includes('sport') || normalizedCategory.includes('activity') || normalizedCategory.includes('outdoor')) {
    return { bg: 'bg-teal-500', hover: 'hover:bg-teal-600', text: 'text-teal-600', hex: '#14B8A6' };
  }

  return { bg: 'bg-amber-500', hover: 'hover:bg-amber-600', text: 'text-amber-600', hex: '#F59E0B' };
};

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

// Day colors for route display
const DAY_COLORS = [
  { stroke: '#4F46E5', name: 'Indigo' },   // Day 1
  { stroke: '#10B981', name: 'Emerald' },  // Day 2
  { stroke: '#F59E0B', name: 'Amber' },    // Day 3
  { stroke: '#EF4444', name: 'Red' },      // Day 4
  { stroke: '#8B5CF6', name: 'Violet' },   // Day 5
  { stroke: '#06B6D4', name: 'Cyan' },     // Day 6
  { stroke: '#EC4899', name: 'Pink' },     // Day 7
];

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
 * Cluster Marker Component - Shows cluster count
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

  const colors = getCategoryColor(dominantCategory);

  // Size based on point count
  const size = Math.min(40 + (pointCount / 5) * 4, 60);

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
        className="cursor-pointer transition-all duration-200 hover:scale-110"
        style={{ width: size, height: size }}
      >
        <div
          className={`w-full h-full rounded-full flex items-center justify-center shadow-lg border-4 border-white`}
          style={{ backgroundColor: colors.hex }}
        >
          <span className="text-white font-bold text-sm">{pointCount}</span>
        </div>
      </div>
    </Marker>
  );
};

/**
 * POI Hover Preview Card - Shows quick info on hover
 */
const POIHoverPreview = ({ poi, position, onSchedule, onEdit }) => {
  const colors = getCategoryColor(poi.category);

  return (
    <div
      className="absolute z-20 pointer-events-none"
      style={{
        left: position.x,
        top: position.y - 120,
        transform: 'translateX(-50%)',
      }}
    >
      <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-3 min-w-[180px] max-w-[220px] pointer-events-auto">
        {/* Header with icon and name */}
        <div className="flex items-start space-x-2 mb-2">
          <div className={`${colors.bg} text-white p-1.5 rounded-full flex-shrink-0`}>
            {renderCategoryIcon(poi.category, "w-3 h-3")}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-gray-900 text-sm leading-tight truncate">{poi.name}</h4>
            <span className={`text-xs ${colors.text} font-medium`}>{poi.category}</span>
          </div>
        </div>

        {/* Quick info */}
        <div className="flex items-center text-xs text-gray-500 space-x-3 mb-2">
          {poi.dwell_time && (
            <span className="flex items-center">
              <Clock className="w-3 h-3 mr-1" />
              {poi.dwell_time}m
            </span>
          )}
          {poi.scheduled_day && (
            <span className="flex items-center text-indigo-600 font-medium">
              <Calendar className="w-3 h-3 mr-1" />
              Day {poi.scheduled_day}
            </span>
          )}
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center space-x-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSchedule && onSchedule(poi);
            }}
            className="flex-1 flex items-center justify-center px-2 py-1 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded transition-colors"
          >
            <Calendar className="w-3 h-3 mr-1" />
            Schedule
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit && onEdit(poi);
            }}
            className="flex items-center justify-center px-2 py-1 text-xs bg-gray-50 hover:bg-gray-100 text-gray-700 rounded transition-colors"
          >
            <Pencil className="w-3 h-3" />
          </button>
        </div>

        {/* Arrow pointing down */}
        <div className="absolute left-1/2 bottom-0 transform -translate-x-1/2 translate-y-full">
          <div className="border-8 border-transparent border-t-white" />
        </div>
      </div>
    </div>
  );
};

/**
 * POI Marker Component with enhanced visuals
 */
const POIMarker = ({
  poi,
  isHovered,
  isSelected,
  onClick,
  onHover,
  onLeave,
  onDragStart,
  onDrag,
  onDragEnd,
  dayNumber,
  orderInDay,
  isDraggable = false,
}) => {
  const colors = getCategoryColor(poi.category);
  const showHighlight = isHovered || isSelected;
  const isScheduled = poi.scheduled_day || dayNumber;

  // Different marker shape for scheduled vs unscheduled
  const markerShape = isScheduled ? 'rounded-lg' : 'rounded-full';

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
          cursor-pointer transition-all duration-200
          ${showHighlight ? 'scale-125 z-10' : 'scale-100'}
          ${isDraggable ? 'cursor-grab active:cursor-grabbing' : ''}
        `}
        onMouseEnter={() => onHover(poi)}
        onMouseLeave={onLeave}
      >
        <div className={`
          ${colors.bg} ${colors.hover}
          text-white p-2 ${markerShape} shadow-lg
          transition-colors duration-200 relative
          ${isSelected ? 'ring-4 ring-indigo-400 ring-opacity-75' : ''}
          ${isScheduled ? 'border-2 border-white' : ''}
        `}>
          {/* Day number badge for scheduled POIs */}
          {dayNumber && (
            <div className="absolute -top-2 -right-2 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-md border border-gray-200">
              <span className="text-xs font-bold text-gray-700">{dayNumber}</span>
            </div>
          )}

          {renderCategoryIcon(poi.category, "w-4 h-4")}

          {/* Drag handle indicator when draggable */}
          {isDraggable && (
            <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 translate-y-full">
              <GripVertical className="w-3 h-3 text-gray-400" />
            </div>
          )}
        </div>
      </div>
    </Marker>
  );
};

/**
 * Add POI Mode Overlay
 */
const AddPOIModeOverlay = ({ onCancel }) => (
  <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-indigo-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center space-x-2">
    <Plus className="w-4 h-4" />
    <span className="text-sm font-medium">Click on the map to add a POI</span>
    <button
      onClick={onCancel}
      className="ml-2 p-1 hover:bg-indigo-700 rounded-full transition-colors"
    >
      <X className="w-4 h-4" />
    </button>
  </div>
);

/**
 * POI Popup Content
 */
const POIPopupContent = ({ poi, onVote, onEdit, onDelete }) => {
  const colors = getCategoryColor(poi.category);
  const score = (poi.likes || 0) - (poi.vetoes || 0);

  return (
    <div className="p-3 min-w-[200px] max-w-[280px]">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center space-x-2">
          <div className={`${colors.bg} text-white p-1.5 rounded-full`}>
            {renderCategoryIcon(poi.category, "w-3 h-3")}
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 text-sm leading-tight">{poi.name}</h4>
            <span className={`text-xs ${colors.text} font-medium`}>{poi.category}</span>
          </div>
        </div>
        {/* Score badge */}
        <div className={`
          px-2 py-0.5 rounded-full text-xs font-medium
          ${score > 5 ? 'bg-green-100 text-green-800' :
            score < 0 ? 'bg-red-100 text-red-800' :
            'bg-gray-100 text-gray-800'}
        `}>
          {score > 0 ? '+' : ''}{score}
        </div>
      </div>

      {/* Description */}
      {poi.description && (
        <p className="text-xs text-gray-600 mb-3 line-clamp-2">{poi.description}</p>
      )}

      {/* Details */}
      <div className="space-y-1.5 text-xs text-gray-500">
        {poi.dwell_time && (
          <div className="flex items-center">
            <Clock className="w-3 h-3 mr-1.5" />
            <span>{poi.dwell_time} min</span>
          </div>
        )}
        {(poi.estimated_cost || poi.actual_cost) && (
          <div className="flex items-center">
            <DollarSign className="w-3 h-3 mr-1.5" />
            <span>
              {poi.actual_cost ? `${poi.actual_cost} ${poi.currency || 'USD'}` :
               poi.estimated_cost ? `~${poi.estimated_cost} ${poi.currency || 'USD'}` : null}
            </span>
          </div>
        )}
        {poi.address && (
          <div className="flex items-start">
            <MapPin className="w-3 h-3 mr-1.5 mt-0.5 flex-shrink-0" />
            <span className="line-clamp-2">{poi.address}</span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between">
        {/* Voting buttons */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => onVote && onVote(poi.id, 'like')}
            className="flex items-center px-2 py-1 text-xs bg-green-50 hover:bg-green-100 text-green-700 rounded transition-colors"
            title="Like this POI"
          >
            <ThumbsUp className="w-3 h-3 mr-1" />
            {poi.likes || 0}
          </button>
          <button
            onClick={() => onVote && onVote(poi.id, 'veto')}
            className="flex items-center px-2 py-1 text-xs bg-red-50 hover:bg-red-100 text-red-700 rounded transition-colors"
            title="Veto this POI"
          >
            <ThumbsDown className="w-3 h-3 mr-1" />
            {poi.vetoes || 0}
          </button>
        </div>
        {/* Edit/Delete buttons */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => onEdit && onEdit(poi)}
            className="p-1.5 hover:bg-gray-100 rounded transition-colors"
            title="Edit POI"
          >
            <Pencil className="w-3.5 h-3.5 text-gray-500" />
          </button>
          <button
            onClick={() => onDelete && onDelete(poi)}
            className="p-1.5 hover:bg-red-50 rounded transition-colors"
            title="Delete POI"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-500" />
          </button>
        </div>
      </div>
      {poi.priority > 0 && (
        <div className="mt-2 text-xs text-amber-500 font-medium">
          ★ Priority {poi.priority}
        </div>
      )}
    </div>
  );
};

/**
 * Context Menu for marker right-click
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
      className="absolute z-30 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[160px]"
      style={{ left: position.x, top: position.y }}
    >
      <button
        onClick={() => { onCenterMap(poi); onClose(); }}
        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center"
      >
        <MapPin className="w-4 h-4 mr-2 text-gray-400" />
        Center on map
      </button>
      <button
        onClick={() => { onSchedule(poi); onClose(); }}
        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center"
      >
        <Calendar className="w-4 h-4 mr-2 text-gray-400" />
        Schedule
      </button>
      <button
        onClick={() => { onEdit(poi); onClose(); }}
        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center"
      >
        <Pencil className="w-4 h-4 mr-2 text-gray-400" />
        Edit
      </button>
      <div className="border-t border-gray-100 my-1" />
      <button
        onClick={() => { onDelete(poi); onClose(); }}
        className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center"
      >
        <Trash2 className="w-4 h-4 mr-2" />
        Delete
      </button>
    </div>
  );
};

/**
 * Enhanced Legend Component with toggles and collapsibility
 */
const MapLegend = ({
  categories,
  accommodationCount = 0,
  visibleCategories,
  onToggleCategory,
  showAccommodations,
  onToggleAccommodations,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if ((!categories || categories.length === 0) && accommodationCount === 0) return null;

  return (
    <div className="absolute bottom-8 left-3 z-10 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 overflow-hidden max-w-[200px]">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4 text-gray-500" />
          <span className="text-xs font-semibold text-gray-700">Legend</span>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-1.5">
          {/* Accommodation toggle */}
          {accommodationCount > 0 && (
            <button
              onClick={() => onToggleAccommodations && onToggleAccommodations()}
              className={`w-full flex items-center space-x-2 p-1.5 rounded transition-colors ${
                showAccommodations ? 'bg-blue-50' : 'bg-gray-50 opacity-50'
              }`}
            >
              <div className={`bg-blue-600 text-white p-1 rounded-full ${!showAccommodations && 'opacity-50'}`}>
                <Bed className="w-2.5 h-2.5" />
              </div>
              <span className="text-xs text-gray-600 flex-1 text-left">Accommodation</span>
              {showAccommodations ? (
                <Eye className="w-3 h-3 text-blue-500" />
              ) : (
                <EyeOff className="w-3 h-3 text-gray-400" />
              )}
            </button>
          )}

          {/* Category toggles */}
          {categories.map((category) => {
            const colors = getCategoryColor(category);
            const isVisible = !visibleCategories || visibleCategories.includes(category);

            return (
              <button
                key={category}
                onClick={() => onToggleCategory && onToggleCategory(category)}
                className={`w-full flex items-center space-x-2 p-1.5 rounded transition-colors ${
                  isVisible ? 'hover:bg-gray-50' : 'bg-gray-50 opacity-50'
                }`}
              >
                <div className={`${colors.bg} text-white p-1 rounded-full ${!isVisible && 'opacity-50'}`}>
                  {renderCategoryIcon(category, "w-2.5 h-2.5")}
                </div>
                <span className="text-xs text-gray-600 truncate flex-1 text-left">{category}</span>
                {isVisible ? (
                  <Eye className="w-3 h-3 text-gray-400" />
                ) : (
                  <EyeOff className="w-3 h-3 text-gray-400" />
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
 * Accommodation Popup Content
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
    <div className="p-3 min-w-[200px] max-w-[280px]">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center space-x-2">
          <span className="text-xl">{typeEmoji[accommodation.type] || typeEmoji.other}</span>
          <div>
            <h4 className="font-semibold text-gray-900 text-sm leading-tight">{accommodation.name}</h4>
            <span className="text-xs text-blue-600 font-medium capitalize">{accommodation.type}</span>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="space-y-1.5 text-xs text-gray-500">
        {/* Dates */}
        <div className="flex items-center">
          <Clock className="w-3 h-3 mr-1.5" />
          <span>{accommodation.check_in_date} - {accommodation.check_out_date}</span>
          <span className="ml-1 text-blue-600">({nights} night{nights !== 1 ? 's' : ''})</span>
        </div>

        {/* Cost */}
        {accommodation.total_cost && (
          <div className="flex items-center">
            <DollarSign className="w-3 h-3 mr-1.5" />
            <span>{accommodation.total_cost} {accommodation.currency || 'USD'}</span>
          </div>
        )}

        {/* Address */}
        {accommodation.address && (
          <div className="flex items-start">
            <MapPin className="w-3 h-3 mr-1.5 mt-0.5 flex-shrink-0" />
            <span className="line-clamp-2">{accommodation.address}</span>
          </div>
        )}

        {/* Booking Reference */}
        {accommodation.booking_reference && (
          <div className="flex items-center text-gray-400">
            <span className="mr-1">#</span>
            <span className="font-mono">{accommodation.booking_reference}</span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      {(onEdit || onDelete) && (
        <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-end space-x-1">
          {onEdit && (
            <button
              onClick={() => onEdit(accommodation)}
              className="p-1.5 hover:bg-gray-100 rounded transition-colors"
              title="Edit accommodation"
            >
              <Pencil className="w-3.5 h-3.5 text-gray-500" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(accommodation.id)}
              className="p-1.5 hover:bg-red-50 rounded transition-colors"
              title="Delete accommodation"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-500" />
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
  }, [destination?.id, destinationCoords, zoom]);

  // Effect to fly to POI when centerOnPOI changes
  useEffect(() => {
    if (centerOnPOI && mapRef.current) {
      const coords = getCoordinates(centerOnPOI);
      if (coords) {
        mapRef.current.flyTo({
          center: [coords.lng, coords.lat],
          zoom: 16,
          duration: 1000,
        });
        // Also open the popup for this POI
        setPopupInfo({
          ...centerOnPOI,
          ...coords,
        });
        setPopupType('poi');
      }
    }
  }, [centerOnPOI]);

  // Clear pending location when POIs change (i.e., new POI was added)
  useEffect(() => {
    setPendingLocation(null);
  }, [pois]);

  // Clear pending location when triggered externally (e.g., modal closed without creating POI)
  useEffect(() => {
    if (clearPendingTrigger > 0) {
      setPendingLocation(null);
    }
  }, [clearPendingTrigger]);

  // Calculate routes when poisByDay changes
  useEffect(() => {
    if (Object.keys(poisByDay).length > 0) {
      calculateAllDayRoutes(poisByDay);
    }
  }, [poisByDay, calculateAllDayRoutes]);

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
        dayPois.forEach((poi, index) => {
          info[poi.id] = {
            dayNumber: day.dayNumber,
            orderInDay: index + 1,
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
      radius: 60,
      maxZoom: 16,
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
        zoom: 16,
        duration: 500,
      });
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
      className={`relative rounded-lg overflow-hidden border border-gray-200 ${className}`}
      style={{ height }}
    >
      {/* Add POI Mode Overlay */}
      {isAddMode && <AddPOIModeOverlay onCancel={toggleAddMode} />}

      {/* Add POI Button */}
      {enableAddPOI && onAddPOI && !isAddMode && (
        <button
          onClick={toggleAddMode}
          className="absolute top-3 right-14 z-10 bg-white hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded-lg shadow-lg flex items-center space-x-1.5 text-sm font-medium transition-colors border border-gray-200"
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
        <ScaleControl position="bottom-right" />

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
                onClick={() => handleMarkerClick({ ...poi, id: poi.poiId, lng: longitude, lat: latitude })}
                onHover={(p) => handlePOIHover(p)}
                onLeave={handlePOILeave}
                onDragEnd={(e) => handleMarkerDragEnd({ ...poi, id: poi.poiId }, e)}
                dayNumber={dayInfo?.dayNumber}
                orderInDay={dayInfo?.orderInDay}
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
                onClick={handleMarkerClick}
                onHover={(p) => handlePOIHover(p)}
                onLeave={handlePOILeave}
                onDragEnd={(e) => handleMarkerDragEnd(poi, e)}
                dayNumber={dayInfo?.dayNumber}
                orderInDay={dayInfo?.orderInDay}
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
        />
      )}

      {/* Day Route Controls - shown when we have days with POIs */}
      {showRouteControls && days.length > 0 && (
        <>
          {/* Day Route Toggle Buttons - Top Left */}
          <div className="absolute top-3 left-3 z-10">
            <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-2">
              <div className="text-xs font-medium text-gray-500 mb-1.5">Show routes:</div>
              <div className="flex flex-wrap items-center gap-1.5">
                {days.map((day, index) => {
                  const dayPois = poisByDay[day.date] || [];
                  const isVisible = visibleDays.includes(day.date);
                  const hasRoute = dayPois.length >= 2;
                  const color = DAY_COLORS[index % DAY_COLORS.length];

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
                            ? 'text-white shadow-sm'
                            : 'text-gray-600 hover:bg-gray-100 border border-gray-200'
                          : 'text-gray-300 cursor-not-allowed'
                        }
                      `}
                      style={hasRoute && isVisible ? { backgroundColor: color.stroke } : {}}
                      title={hasRoute ? `Day ${day.dayNumber}: ${dayPois.length} POIs` : 'No route (need 2+ POIs)'}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: hasRoute ? color.stroke : '#D1D5DB' }}
                      />
                      Day {day.dayNumber}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Route Legend - Top Right (when multiple routes visible) */}
          {visibleRoutes.length > 1 && (
            <div className="absolute top-3 right-14 z-10">
              <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-2">
                <div className="text-xs font-medium text-gray-500 mb-1">Route Legend</div>
                <div className="space-y-1">
                  {visibleRoutes.map((route) => {
                    const day = days.find(d => d.date === route.date);
                    const color = DAY_COLORS[route.dayIndex % DAY_COLORS.length];
                    return (
                      <div key={route.date} className="flex items-center gap-1.5 text-xs">
                        <span
                          className="w-3 h-0.5 rounded"
                          style={{ backgroundColor: color.stroke }}
                        />
                        <span className="text-gray-700">Day {day?.dayNumber}</span>
                        <span className="text-gray-400">
                          {formatDistance(route.totalDistance)} · {formatDuration(route.totalDuration)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Route Summary Bar - Bottom (when routes visible) */}
          {visibleRoutes.length > 0 && (
            <div className="absolute bottom-3 left-3 right-3 z-10">
              <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Route summary */}
                    <div className="flex items-center gap-1.5">
                      <Route className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-medium text-gray-600">
                        {visibleRoutes.length} {visibleRoutes.length === 1 ? 'day' : 'days'}
                      </span>
                    </div>

                    {/* Total stats */}
                    <div className="h-4 w-px bg-gray-200" />
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-sm font-medium text-gray-900">
                        {formatDistance(visibleRoutes.reduce((sum, r) => sum + r.totalDistance, 0))}
                      </span>
                    </div>
                    <div className="h-4 w-px bg-gray-200" />
                    <div className="flex items-center gap-1.5">
                      <Footprints className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-sm font-medium text-gray-900">
                        {formatDuration(visibleRoutes.reduce((sum, r) => sum + r.totalDuration, 0))}
                      </span>
                    </div>

                    {isCalculating && (
                      <span className="text-xs text-gray-500 animate-pulse">Calculating...</span>
                    )}
                  </div>

                  {/* Export buttons */}
                  <div className="flex items-center gap-1">
                    {visibleRoutes.length === 1 && (
                      <button
                        onClick={() => handleExportDayToGoogleMaps(visibleRoutes[0].date)}
                        disabled={isCalculating}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Google Maps</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default MicroMap;
