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
  Pencil,
  Trash2,
  ThumbsUp,
  ThumbsDown,
  Filter,
  X,
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
const POIItem = ({ poi, isSelected, onSelect, onCenter, onEdit, onDelete, onVote, showTime }) => {
  const [isHovered, setIsHovered] = useState(false);
  // Get the icon component from the mapping (not creating component during render)
  const CategoryIcon = categoryIcons[poi.category] || MapPin;
  const score = (poi.likes || 0) - (poi.vetoes || 0);

  const handleCheckboxChange = (e) => {
    e.stopPropagation();
    onSelect();
  };

  const handleItemClick = () => {
    onCenter();
  };

  const handleEdit = (e) => {
    e.stopPropagation();
    if (onEdit) onEdit(poi);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    if (onDelete) onDelete(poi);
  };

  const handleVote = (e, voteType) => {
    e.stopPropagation();
    if (onVote) onVote(poi.id, voteType);
  };

  return (
    <div
      className={`
        flex items-center p-2 rounded cursor-pointer transition-colors group
        ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/30 border-l-2 border-indigo-500' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 border-l-2 border-transparent'}
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={handleCheckboxChange}
        className="w-4 h-4 text-indigo-600 rounded mr-2 flex-shrink-0 cursor-pointer"
      />
      <div className="flex-1 min-w-0" onClick={handleItemClick}>
        <div className="flex items-center justify-between">
          <div className="flex items-center min-w-0 flex-1">
            {showTime && poi.timeSlot && (
              <span className="text-xs text-gray-500 dark:text-gray-400 mr-2 font-medium">{poi.timeSlot}</span>
            )}
            <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{poi.name}</span>
          </div>
          {/* Action buttons - visible on hover */}
          <div className={`flex items-center space-x-1 ml-2 transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
            <button
              onClick={(e) => handleVote(e, 'like')}
              className="p-1 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors"
              title="Like"
            >
              <ThumbsUp className="w-3 h-3 text-green-600 dark:text-green-400" />
            </button>
            <button
              onClick={(e) => handleVote(e, 'veto')}
              className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
              title="Veto"
            >
              <ThumbsDown className="w-3 h-3 text-red-600 dark:text-red-400" />
            </button>
            <button
              onClick={handleEdit}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
              title="Edit POI"
            >
              <Pencil className="w-3 h-3 text-gray-500 dark:text-gray-400" />
            </button>
            <button
              onClick={handleDelete}
              className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
              title="Delete POI"
            >
              <Trash2 className="w-3 h-3 text-red-500 dark:text-red-400" />
            </button>
          </div>
        </div>
        <div className="flex items-center mt-0.5 gap-2">
          <span
            className={`text-xs px-1.5 py-0.5 rounded flex items-center ${categoryColors[poi.category] || 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}
          >
            <CategoryIcon className="w-3 h-3 mr-1" />
            {poi.category}
          </span>
          {/* Score badge */}
          {(poi.likes > 0 || poi.vetoes > 0) && (
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              score > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
              score < 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
              'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
            }`}>
              {score > 0 ? '+' : ''}{score}
            </span>
          )}
          {poi.rating && (
            <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
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
  onEditPOI,
  onDeletePOI,
  onVotePOI,
  className = '',
}) => {
  const [expandedDays, setExpandedDays] = useState({});
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  const allPOIs = useMemo(() => flattenPOIs(pois), [pois]);

  // Get unique categories for filter menu
  const availableCategories = useMemo(() => {
    const cats = new Set();
    allPOIs.forEach((poi) => {
      if (poi.category) cats.add(poi.category);
    });
    return Array.from(cats).sort();
  }, [allPOIs]);

  // Filter POIs by category
  const filteredPOIs = useMemo(() => {
    if (!categoryFilter) return allPOIs;
    return allPOIs.filter((poi) => poi.category === categoryFilter);
  }, [allPOIs, categoryFilter]);

  const nights = useMemo(
    () => calculateNights(destination?.arrival_date, destination?.departure_date),
    [destination?.arrival_date, destination?.departure_date]
  );
  const { days, unassigned } = useMemo(
    () => organizeByDay(filteredPOIs, destination?.arrival_date, nights),
    [filteredPOIs, destination?.arrival_date, nights]
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
      <div className={`flex flex-col h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 w-80 ${className}`}>
        <div className="p-4 text-gray-500 dark:text-gray-400">No destination selected</div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 w-80 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <button
          onClick={onBack}
          className="flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-2 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to route
        </button>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {destination.name || destination.city_name}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {formatDate(destination.arrival_date)} - {formatDate(destination.departure_date)}
        </p>
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
            {nights} {nights === 1 ? 'night' : 'nights'} · {allPOIs.length} POI{allPOIs.length !== 1 ? 's' : ''}
          </p>
          {/* Category Filter Button */}
          {availableCategories.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowFilterMenu(!showFilterMenu)}
                className={`flex items-center text-xs px-2 py-1 rounded transition-colors ${
                  categoryFilter
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Filter className="w-3 h-3 mr-1" />
                {categoryFilter || 'Filter'}
                {categoryFilter && (
                  <X
                    className="w-3 h-3 ml-1 hover:text-red-500"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCategoryFilter(null);
                    }}
                  />
                )}
              </button>
              {/* Filter Dropdown */}
              {showFilterMenu && (
                <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 z-50 py-1">
                  <button
                    onClick={() => {
                      setCategoryFilter(null);
                      setShowFilterMenu(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-600 ${
                      !categoryFilter ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    All Categories
                  </button>
                  {availableCategories.map((cat) => {
                    const CategoryIcon = categoryIcons[cat] || MapPin;
                    return (
                      <button
                        key={cat}
                        onClick={() => {
                          setCategoryFilter(cat);
                          setShowFilterMenu(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center ${
                          categoryFilter === cat ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <CategoryIcon className="w-3 h-3 mr-2" />
                        {cat}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Day Sections */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {days.map(({ dayNumber, date, scheduled, unscheduled }) => {
          const isExpanded = expandedDays[dayNumber] !== false;
          const totalPOIs = scheduled.length + unscheduled.length;

          return (
            <div key={dayNumber} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              {/* Day Header */}
              <button
                onClick={() => toggleDay(dayNumber)}
                className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center">
                  <span className="font-medium text-sm text-gray-900 dark:text-white">
                    {formatDayHeader(dayNumber, date)}
                  </span>
                  {totalPOIs > 0 && (
                    <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">({totalPOIs})</span>
                  )}
                </div>
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                )}
              </button>

              {/* Day POIs */}
              {isExpanded && (
                <div className="p-2 space-y-1">
                  {scheduled.length === 0 && unscheduled.length === 0 ? (
                    <p className="text-xs text-gray-400 dark:text-gray-500 italic p-2">No activities planned</p>
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
                          onEdit={onEditPOI}
                          onDelete={onDeletePOI}
                          onVote={onVotePOI}
                          showTime={true}
                        />
                      ))}

                      {/* Unscheduled POIs */}
                      {unscheduled.length > 0 && (
                        <>
                          {scheduled.length > 0 && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 mb-1 px-2">Unscheduled:</p>
                          )}
                          {unscheduled.map((poi) => (
                            <POIItem
                              key={poi.id}
                              poi={poi}
                              isSelected={isPOISelected(poi.id)}
                              onSelect={() => handlePOISelect(poi.id)}
                              onCenter={() => handleCenterMap(poi)}
                              onEdit={onEditPOI}
                              onDelete={onDeletePOI}
                              onVote={onVotePOI}
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
          <div className="border border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-3">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Not yet scheduled:</p>
            <div className="space-y-1">
              {unassigned.map((poi) => (
                <POIItem
                  key={poi.id}
                  poi={poi}
                  isSelected={isPOISelected(poi.id)}
                  onSelect={() => handlePOISelect(poi.id)}
                  onCenter={() => handleCenterMap(poi)}
                  onEdit={onEditPOI}
                  onDelete={onDeletePOI}
                  onVote={onVotePOI}
                  showTime={false}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer with selection summary */}
      {selectedPOIs.length > 0 && (
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-indigo-50 dark:bg-indigo-900/30">
          <p className="text-xs text-indigo-700 dark:text-indigo-300">
            <span className="font-medium">{selectedPOIs.length}</span> POI
            {selectedPOIs.length !== 1 ? 's' : ''} highlighted on map
          </p>
        </div>
      )}
    </div>
  );
};

export default DayBasedAgenda;
