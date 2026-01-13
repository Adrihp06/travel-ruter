import React, { useMemo, useState } from 'react';
import {
  Building2,
  MapPin,
  Clock,
  DollarSign,
  ChevronDown,
  ChevronRight,
  Landmark,
  UtensilsCrossed,
  Mountain,
  Camera,
  ShoppingBag,
  Music,
  TreePine,
  Star,
} from 'lucide-react';

// Category icon mapping
const getCategoryIcon = (category) => {
  const icons = {
    'Sights': Landmark,
    'Museums': Landmark,
    'Food': UtensilsCrossed,
    'Restaurants': UtensilsCrossed,
    'Viewpoints': Mountain,
    'Nature': TreePine,
    'Shopping': ShoppingBag,
    'Entertainment': Music,
    'Photography': Camera,
  };
  return icons[category] || MapPin;
};

// Category color mapping
const getCategoryColor = (category) => {
  const colors = {
    'Sights': 'bg-indigo-100 text-indigo-600',
    'Museums': 'bg-purple-100 text-purple-600',
    'Food': 'bg-orange-100 text-orange-600',
    'Restaurants': 'bg-orange-100 text-orange-600',
    'Viewpoints': 'bg-emerald-100 text-emerald-600',
    'Nature': 'bg-green-100 text-green-600',
    'Shopping': 'bg-pink-100 text-pink-600',
    'Entertainment': 'bg-yellow-100 text-yellow-600',
    'Photography': 'bg-cyan-100 text-cyan-600',
  };
  return colors[category] || 'bg-gray-100 text-gray-600';
};

const Agenda = ({
  destination,
  accommodation,
  pois = [],
  selectedPOIs = [],
  onSelectPOI,
  onCenterMapOnPOI,
  className = '',
}) => {
  const [expandedCategories, setExpandedCategories] = useState({});

  // Initialize all categories as expanded by default
  useMemo(() => {
    if (pois.length > 0) {
      const initialExpanded = {};
      pois.forEach((cat) => {
        initialExpanded[cat.category] = true;
      });
      setExpandedCategories(initialExpanded);
    }
  }, [pois]);

  const toggleCategory = (category) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const handlePOIClick = (poi) => {
    if (onCenterMapOnPOI) {
      onCenterMapOnPOI(poi);
    }
  };

  const handlePOISelect = (e, poiId) => {
    e.stopPropagation();
    if (onSelectPOI) {
      onSelectPOI(poiId);
    }
  };

  const isPOISelected = (poiId) => {
    return selectedPOIs.includes(poiId);
  };

  // Format currency
  const formatCost = (cost, currency = 'USD') => {
    if (cost === undefined || cost === null) return null;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cost);
  };

  // Format dwell time
  const formatDwellTime = (minutes) => {
    if (!minutes) return null;
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  return (
    <div className={`flex flex-col h-full bg-white border-r border-gray-200 w-80 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <h2 className="text-lg font-semibold text-gray-900">Agenda</h2>
        {destination && (
          <p className="text-sm text-gray-500 mt-1">{destination.name || destination.city_name}</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Accommodation Section */}
        {accommodation && (
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center mb-3">
              <div className="p-2 rounded-lg bg-indigo-100 mr-3">
                <Building2 className="w-4 h-4 text-indigo-600" />
              </div>
              <h3 className="font-medium text-gray-900">Accommodation</h3>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
              <h4 className="font-medium text-gray-900">{accommodation.name}</h4>

              {accommodation.address && (
                <div className="flex items-start text-sm text-gray-600">
                  <MapPin className="w-3.5 h-3.5 mr-2 mt-0.5 flex-shrink-0 text-gray-400" />
                  <span>{accommodation.address}</span>
                </div>
              )}

              <div className="flex flex-wrap gap-3 pt-2">
                {accommodation.checkIn && (
                  <div className="flex items-center text-xs">
                    <span className="text-gray-500 mr-1">Check-in:</span>
                    <span className="font-medium text-gray-700">{accommodation.checkIn}</span>
                  </div>
                )}
                {accommodation.checkOut && (
                  <div className="flex items-center text-xs">
                    <span className="text-gray-500 mr-1">Check-out:</span>
                    <span className="font-medium text-gray-700">{accommodation.checkOut}</span>
                  </div>
                )}
              </div>

              {accommodation.notes && (
                <p className="text-xs text-gray-500 pt-1 border-t border-gray-200 mt-2">
                  {accommodation.notes}
                </p>
              )}
            </div>
          </div>
        )}

        {/* POIs by Category */}
        <div className="p-4">
          <h3 className="font-medium text-gray-900 mb-3">Points of Interest</h3>

          {pois.length === 0 ? (
            <p className="text-sm text-gray-500 italic">No points of interest yet.</p>
          ) : (
            <div className="space-y-3">
              {pois.map((categoryGroup) => {
                const CategoryIcon = getCategoryIcon(categoryGroup.category);
                const categoryColor = getCategoryColor(categoryGroup.category);
                const isExpanded = expandedCategories[categoryGroup.category] !== false;
                const selectedCount = categoryGroup.pois.filter((p) => isPOISelected(p.id)).length;

                return (
                  <div key={categoryGroup.category} className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Category Header */}
                    <button
                      onClick={() => toggleCategory(categoryGroup.category)}
                      className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center">
                        <div className={`p-1.5 rounded-md ${categoryColor} mr-2`}>
                          <CategoryIcon className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-medium text-gray-900 text-sm">
                          {categoryGroup.category}
                        </span>
                        <span className="ml-2 text-xs text-gray-500">
                          ({categoryGroup.pois.length})
                        </span>
                        {selectedCount > 0 && (
                          <span className="ml-2 px-1.5 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-600 rounded">
                            {selectedCount} selected
                          </span>
                        )}
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      )}
                    </button>

                    {/* POI List */}
                    {isExpanded && (
                      <div className="divide-y divide-gray-100">
                        {categoryGroup.pois.map((poi) => {
                          const selected = isPOISelected(poi.id);

                          return (
                            <div
                              key={poi.id}
                              onClick={() => handlePOIClick(poi)}
                              className={`
                                p-3 cursor-pointer transition-all
                                ${selected
                                  ? 'bg-indigo-50 border-l-2 border-indigo-500'
                                  : 'bg-white hover:bg-gray-50 border-l-2 border-transparent'}
                              `}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center">
                                    <h4 className={`font-medium text-sm truncate ${selected ? 'text-indigo-900' : 'text-gray-900'}`}>
                                      {poi.name}
                                    </h4>
                                    {poi.rating && (
                                      <div className="flex items-center ml-2 text-amber-500">
                                        <Star className="w-3 h-3 fill-current" />
                                        <span className="text-xs ml-0.5">{poi.rating}</span>
                                      </div>
                                    )}
                                  </div>

                                  {poi.description && (
                                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                      {poi.description}
                                    </p>
                                  )}

                                  {/* POI Details: Cost and Dwell Time */}
                                  <div className="flex items-center gap-3 mt-2">
                                    {poi.estimatedCost !== undefined && (
                                      <div className="flex items-center text-xs text-gray-600">
                                        <DollarSign className="w-3 h-3 mr-0.5 text-gray-400" />
                                        <span>{formatCost(poi.estimatedCost, poi.currency)}</span>
                                      </div>
                                    )}
                                    {poi.dwellTime && (
                                      <div className="flex items-center text-xs text-gray-600">
                                        <Clock className="w-3 h-3 mr-0.5 text-gray-400" />
                                        <span>{formatDwellTime(poi.dwellTime)}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Selection Checkbox */}
                                <button
                                  onClick={(e) => handlePOISelect(e, poi.id)}
                                  className={`
                                    ml-2 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
                                    ${selected
                                      ? 'bg-indigo-600 border-indigo-600 text-white'
                                      : 'border-gray-300 hover:border-indigo-400'}
                                  `}
                                  title={selected ? 'Deselect POI' : 'Select to highlight on map'}
                                >
                                  {selected && (
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer with selection summary */}
      {selectedPOIs.length > 0 && (
        <div className="p-3 border-t border-gray-200 bg-indigo-50">
          <p className="text-xs text-indigo-700">
            <span className="font-medium">{selectedPOIs.length}</span> POI{selectedPOIs.length !== 1 ? 's' : ''} highlighted on map
          </p>
        </div>
      )}
    </div>
  );
};

export default Agenda;
