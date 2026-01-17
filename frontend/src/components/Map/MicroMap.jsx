import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import Map, {
  NavigationControl,
  ScaleControl,
  FullscreenControl,
  Marker,
  Popup,
} from 'react-map-gl';
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
} from 'lucide-react';
import { useMapboxToken } from '../../contexts/MapboxContext';
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
    return { bg: 'bg-blue-500', hover: 'hover:bg-blue-600', text: 'text-blue-600' };
  }
  if (normalizedCategory.includes('food') || normalizedCategory.includes('restaurant') || normalizedCategory.includes('dining') || normalizedCategory.includes('cafe')) {
    return { bg: 'bg-orange-500', hover: 'hover:bg-orange-600', text: 'text-orange-600' };
  }
  if (normalizedCategory.includes('sight') || normalizedCategory.includes('attraction') || normalizedCategory.includes('landmark') || normalizedCategory.includes('monument')) {
    return { bg: 'bg-emerald-500', hover: 'hover:bg-emerald-600', text: 'text-emerald-600' };
  }
  if (normalizedCategory.includes('museum') || normalizedCategory.includes('gallery') || normalizedCategory.includes('historic')) {
    return { bg: 'bg-purple-500', hover: 'hover:bg-purple-600', text: 'text-purple-600' };
  }
  if (normalizedCategory.includes('shop') || normalizedCategory.includes('market') || normalizedCategory.includes('store')) {
    return { bg: 'bg-pink-500', hover: 'hover:bg-pink-600', text: 'text-pink-600' };
  }
  if (normalizedCategory.includes('entertainment') || normalizedCategory.includes('nightlife') || normalizedCategory.includes('bar')) {
    return { bg: 'bg-violet-500', hover: 'hover:bg-violet-600', text: 'text-violet-600' };
  }
  if (normalizedCategory.includes('sport') || normalizedCategory.includes('activity') || normalizedCategory.includes('outdoor')) {
    return { bg: 'bg-teal-500', hover: 'hover:bg-teal-600', text: 'text-teal-600' };
  }

  return { bg: 'bg-amber-500', hover: 'hover:bg-amber-600', text: 'text-amber-600' };
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

/**
 * POI Marker Component
 */
const POIMarker = ({ poi, isHovered, isSelected, onClick, onHover, onLeave }) => {
  const colors = getCategoryColor(poi.category);
  const showHighlight = isHovered || isSelected;

  return (
    <Marker
      longitude={poi.lng}
      latitude={poi.lat}
      anchor="bottom"
      onClick={(e) => {
        e.originalEvent.stopPropagation();
        onClick(poi);
      }}
    >
      <div
        className={`
          cursor-pointer transition-all duration-200
          ${showHighlight ? 'scale-125 z-10' : 'scale-100'}
        `}
        onMouseEnter={() => onHover(poi)}
        onMouseLeave={onLeave}
      >
        <div className={`
          ${colors.bg} ${colors.hover}
          text-white p-2 rounded-full shadow-lg
          transition-colors duration-200
          ${isSelected ? 'ring-4 ring-indigo-400 ring-opacity-75' : ''}
        `}>
          {renderCategoryIcon(poi.category, "w-4 h-4")}
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
 * Legend Component
 */
const MapLegend = ({ categories }) => {
  if (!categories || categories.length === 0) return null;

  return (
    <div className="absolute bottom-8 left-3 z-10 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3 max-w-[180px]">
      <h5 className="text-xs font-semibold text-gray-700 mb-2">Legend</h5>
      <div className="space-y-1.5">
        {categories.map((category) => {
          const colors = getCategoryColor(category);
          return (
            <div key={category} className="flex items-center space-x-2">
              <div className={`${colors.bg} text-white p-1 rounded-full`}>
                {renderCategoryIcon(category, "w-2.5 h-2.5")}
              </div>
              <span className="text-xs text-gray-600 truncate">{category}</span>
            </div>
          );
        })}
      </div>
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
          text-white p-2 rounded-full shadow-lg
          transition-colors duration-200
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
 * - Custom icons per POI category (Bed, Fork, Camera, etc.)
 * - Popup on click with POI details
 * - Click to add new POI mode
 * - Accommodation markers with hotel icon
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
  onAddPOI = null,
  onPOIClick = null,
  onVotePOI = null,
  onEditPOI = null,
  onDeletePOI = null,
  onEditAccommodation = null,
  onDeleteAccommodation = null,
  centerOnPOI = null,
  selectedPOIs = [],
  clearPendingTrigger = 0,
}) => {
  const { mapboxAccessToken } = useMapboxToken();
  const [popupInfo, setPopupInfo] = useState(null);
  const [popupType, setPopupType] = useState(null); // 'poi' or 'accommodation'
  const [hoveredPOI, setHoveredPOI] = useState(null);
  const [hoveredAccommodation, setHoveredAccommodation] = useState(null);
  const [isAddMode, setIsAddMode] = useState(false);
  const [pendingLocation, setPendingLocation] = useState(null);
  const mapRef = useRef(null);

  // Get destination coordinates
  const destinationCoords = useMemo(() => getCoordinates(destination), [destination]);

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
    if (onPOIClick) {
      onPOIClick(poi);
    }
  }, [onPOIClick]);

  // Handle accommodation marker click
  const handleAccommodationClick = useCallback((accommodation) => {
    const coords = getCoordinates(accommodation);
    setPopupInfo({ ...accommodation, lat: coords?.lat, lng: coords?.lng });
    setPopupType('accommodation');
  }, []);

  // Handle map click for adding POI
  const handleMapClick = useCallback((event) => {
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
  }, [isAddMode, onAddPOI]);

  // Toggle add POI mode
  const toggleAddMode = useCallback(() => {
    setIsAddMode((prev) => !prev);
    setPendingLocation(null);
    setPopupInfo(null);
  }, []);

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
        initialViewState={{
          longitude: destinationCoords.lng,
          latitude: destinationCoords.lat,
          zoom: zoom,
        }}
        mapboxAccessToken={mapboxAccessToken}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        onClick={handleMapClick}
        cursor={isAddMode ? 'crosshair' : 'grab'}
      >
        <FullscreenControl position="top-right" />
        <NavigationControl position="top-right" showCompass={true} />
        <ScaleControl position="bottom-right" />

        {/* POI markers */}
        {poiMarkers.map((poi) => (
          <POIMarker
            key={poi.id}
            poi={poi}
            isHovered={hoveredPOI?.id === poi.id}
            isSelected={selectedPOIs.includes(poi.id)}
            onClick={handleMarkerClick}
            onHover={setHoveredPOI}
            onLeave={() => setHoveredPOI(null)}
          />
        ))}

        {/* Accommodation markers */}
        {accommodations.map((accommodation) => (
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

      {/* Legend */}
      {showLegend && <MapLegend categories={categories} />}
    </div>
  );
};

export default MicroMap;
