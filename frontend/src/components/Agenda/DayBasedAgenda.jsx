import React, { useState, useMemo, useEffect } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Star,
  Landmark,
  UtensilsCrossed,
  Mountain,
  TreePine,
  ShoppingBag,
  Music,
  Camera,
  MapPin,
} from 'lucide-react';

// Category icon components mapping
const categoryIcons = {
  'Sights': Landmark,
  'Museums': Landmark,
  'Food': UtensilsCrossed,
  'Restaurants': UtensilsCrossed,
  'Viewpoints': Mountain,
  'Nature': TreePine,
  'Shopping': ShoppingBag,
  'Entertainment': Music,
  'Photography': Camera,
  'Accommodation': MapPin,
  'Activity': MapPin,
};

// Category color mapping
const categoryColors = {
  'Sights': 'bg-emerald-100 text-emerald-800',
  'Museums': 'bg-purple-100 text-purple-800',
  'Food': 'bg-orange-100 text-orange-800',
  'Restaurants': 'bg-orange-100 text-orange-800',
  'Viewpoints': 'bg-emerald-100 text-emerald-800',
  'Nature': 'bg-green-100 text-green-800',
  'Shopping': 'bg-pink-100 text-pink-800',
  'Entertainment': 'bg-yellow-100 text-yellow-800',
  'Photography': 'bg-cyan-100 text-cyan-800',
  'Accommodation': 'bg-blue-100 text-blue-800',
  'Activity': 'bg-teal-100 text-teal-800',
  'Museum': 'bg-purple-100 text-purple-800',
};

// Flatten POIs from category groups
const flattenPOIs = (poisByCategory) => {
  if (!poisByCategory || !Array.isArray(poisByCategory)) return [];
  return poisByCategory.flatMap((group) => group.pois || []);
};

// Calculate nights count
const calculateNights = (arrivalDate, departureDate) => {
  const arrival = new Date(arrivalDate);
  const departure = new Date(departureDate);
  return Math.ceil((departure - arrival) / (1000 * 60 * 60 * 24));
};

// Organize POIs by day
const organizeByDay = (pois, arrivalDate, nights) => {
  const days = [];

  for (let i = 0; i < nights; i++) {
    const dayDate = new Date(arrivalDate);
    dayDate.setDate(dayDate.getDate() + i);

    // Filter POIs assigned to this day
    // Note: POIs need assignedDay field (1-indexed)
    const dayPOIs = pois.filter((poi) => poi.assignedDay === i + 1);
    const scheduled = dayPOIs
      .filter((p) => p.timeSlot)
      .sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));
    const unscheduled = dayPOIs.filter((p) => !p.timeSlot);

    days.push({
      dayNumber: i + 1,
      date: dayDate,
      scheduled,
      unscheduled,
    });
  }

  // POIs without assignedDay
  const unassigned = pois.filter((poi) => !poi.assignedDay);

  return { days, unassigned };
};

// Format day header
const formatDayHeader = (dayNumber, date) => {
  const options = { weekday: 'long', month: 'short', day: 'numeric' };
  return `Day ${dayNumber} - ${date.toLocaleDateString('en-US', options)}`;
};

// POI Item sub-component
const POIItem = ({ poi, isSelected, onSelect, onCenter, showTime }) => {
  // Get the icon component from the mapping (not creating component during render)
  const CategoryIcon = categoryIcons[poi.category] || MapPin;

  const handleCheckboxChange = (e) => {
    e.stopPropagation();
    onSelect();
  };

  const handleItemClick = () => {
    onCenter();
  };

  return (
    <div
      className={`
        flex items-center p-2 rounded cursor-pointer transition-colors
        ${isSelected ? 'bg-indigo-50 border-l-2 border-indigo-500' : 'hover:bg-gray-50 border-l-2 border-transparent'}
      `}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={handleCheckboxChange}
        className="w-4 h-4 text-indigo-600 rounded mr-2 flex-shrink-0 cursor-pointer"
      />
      <div className="flex-1 min-w-0" onClick={handleItemClick}>
        <div className="flex items-center">
          {showTime && poi.timeSlot && (
            <span className="text-xs text-gray-500 mr-2 font-medium">{poi.timeSlot}</span>
          )}
          <span className="text-sm font-medium text-gray-900 truncate">{poi.name}</span>
        </div>
        <div className="flex items-center mt-0.5 gap-2">
          <span
            className={`text-xs px-1.5 py-0.5 rounded flex items-center ${categoryColors[poi.category] || 'bg-gray-100 text-gray-600'}`}
          >
            <CategoryIcon className="w-3 h-3 mr-1" />
            {poi.category}
          </span>
          {poi.rating && (
            <span className="text-xs text-gray-500 flex items-center">
              <Star className="w-3 h-3 mr-0.5 fill-yellow-400 text-yellow-400" />
              {poi.rating}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

const DayBasedAgenda = ({
  destination,
  pois,
  selectedPOIs = [],
  onSelectPOI,
  onCenterMapOnPOI,
  onBack,
  className = '',
}) => {
  const [expandedDays, setExpandedDays] = useState({});

  const allPOIs = useMemo(() => flattenPOIs(pois), [pois]);
  const nights = useMemo(
    () => calculateNights(destination?.arrivalDate, destination?.departureDate),
    [destination?.arrivalDate, destination?.departureDate]
  );
  const { days, unassigned } = useMemo(
    () => organizeByDay(allPOIs, destination?.arrivalDate, nights),
    [allPOIs, destination?.arrivalDate, nights]
  );

  // Initialize all days as expanded by default using useEffect
  useEffect(() => {
    if (days.length > 0) {
      const initialExpanded = {};
      days.forEach((day) => {
        initialExpanded[day.dayNumber] = true;
      });
      setExpandedDays(initialExpanded);
    }
  }, [days]);

  const toggleDay = (dayNumber) => {
    setExpandedDays((prev) => ({
      ...prev,
      [dayNumber]: !prev[dayNumber],
    }));
  };

  const handlePOISelect = (poiId) => {
    if (onSelectPOI) {
      onSelectPOI(poiId);
    }
  };

  const handleCenterMap = (poi) => {
    if (onCenterMapOnPOI) {
      onCenterMapOnPOI(poi);
    }
  };

  const isPOISelected = (poiId) => {
    return selectedPOIs.includes(poiId);
  };

  // Format dates for display
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (!destination) {
    return (
      <div className={`flex flex-col h-full bg-white border-r border-gray-200 w-80 ${className}`}>
        <div className="p-4 text-gray-500">No destination selected</div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-white border-r border-gray-200 w-80 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <button
          onClick={onBack}
          className="flex items-center text-sm text-gray-600 hover:text-gray-900 mb-2 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to route
        </button>
        <h2 className="text-lg font-semibold text-gray-900">
          {destination.name || destination.city_name}
        </h2>
        <p className="text-sm text-gray-500">
          {formatDate(destination.arrivalDate)} - {formatDate(destination.departureDate)}
        </p>
        <p className="text-xs text-indigo-600 font-medium mt-1">
          {nights} {nights === 1 ? 'night' : 'nights'}
        </p>
      </div>

      {/* Day Sections */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {days.map(({ dayNumber, date, scheduled, unscheduled }) => {
          const isExpanded = expandedDays[dayNumber] !== false;
          const totalPOIs = scheduled.length + unscheduled.length;

          return (
            <div key={dayNumber} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Day Header */}
              <button
                onClick={() => toggleDay(dayNumber)}
                className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center">
                  <span className="font-medium text-sm text-gray-900">
                    {formatDayHeader(dayNumber, date)}
                  </span>
                  {totalPOIs > 0 && (
                    <span className="ml-2 text-xs text-gray-500">({totalPOIs})</span>
                  )}
                </div>
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                )}
              </button>

              {/* Day POIs */}
              {isExpanded && (
                <div className="p-2 space-y-1">
                  {scheduled.length === 0 && unscheduled.length === 0 ? (
                    <p className="text-xs text-gray-400 italic p-2">No activities planned</p>
                  ) : (
                    <>
                      {/* Scheduled POIs */}
                      {scheduled.map((poi) => (
                        <POIItem
                          key={poi.id}
                          poi={poi}
                          isSelected={isPOISelected(poi.id)}
                          onSelect={() => handlePOISelect(poi.id)}
                          onCenter={() => handleCenterMap(poi)}
                          showTime={true}
                        />
                      ))}

                      {/* Unscheduled POIs */}
                      {unscheduled.length > 0 && (
                        <>
                          {scheduled.length > 0 && (
                            <p className="text-xs text-gray-400 mt-2 mb-1 px-2">Unscheduled:</p>
                          )}
                          {unscheduled.map((poi) => (
                            <POIItem
                              key={poi.id}
                              poi={poi}
                              isSelected={isPOISelected(poi.id)}
                              onSelect={() => handlePOISelect(poi.id)}
                              onCenter={() => handleCenterMap(poi)}
                              showTime={false}
                            />
                          ))}
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Unassigned POIs Section */}
        {unassigned.length > 0 && (
          <div className="border border-dashed border-gray-300 rounded-lg p-3">
            <p className="text-xs font-medium text-gray-500 mb-2">Not yet scheduled:</p>
            <div className="space-y-1">
              {unassigned.map((poi) => (
                <POIItem
                  key={poi.id}
                  poi={poi}
                  isSelected={isPOISelected(poi.id)}
                  onSelect={() => handlePOISelect(poi.id)}
                  onCenter={() => handleCenterMap(poi)}
                  showTime={false}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer with selection summary */}
      {selectedPOIs.length > 0 && (
        <div className="p-3 border-t border-gray-200 bg-indigo-50">
          <p className="text-xs text-indigo-700">
            <span className="font-medium">{selectedPOIs.length}</span> POI
            {selectedPOIs.length !== 1 ? 's' : ''} highlighted on map
          </p>
        </div>
      )}
    </div>
  );
};

export default DayBasedAgenda;
