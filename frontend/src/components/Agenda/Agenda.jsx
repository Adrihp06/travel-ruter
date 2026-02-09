import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Building2,
  MapPin,
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
import ClockIcon from '@/components/icons/clock-icon';

// Category icon mapping - lookup table, not function creating components
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
};

// Category color mapping
const getCategoryColor = (category) => {
  const colors = {
    'Sights': 'bg-amber-100 text-[#D97706]',
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
  const { t } = useTranslation();
  // Track which categories we've seen to auto-expand new ones
  const seenCategoriesRef = useRef(new Set());
  const [expandedCategories, setExpandedCategories] = useState({});

  // Auto-expand categories when new POIs arrive
  const currentCategories = useMemo(() => {
    const categories = new Set();
    pois.forEach((cat) => categories.add(cat.category));
    return categories;
  }, [pois]);

  // Check for new categories and expand them
  useEffect(() => {
    const newCategories = [];
    currentCategories.forEach((cat) => {
      if (!seenCategoriesRef.current.has(cat)) {
        newCategories.push(cat);
        seenCategoriesRef.current.add(cat);
      }
    });

    if (newCategories.length > 0) {
      setExpandedCategories((prev) => {
        const updated = { ...prev };
        newCategories.forEach((cat) => {
          updated[cat] = true;
        });
        return updated;
      });
    }
  }, [currentCategories]);

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
    if (minutes < 60) return `${Math.round(minutes)} min`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  return (
    <div className={`flex flex-col h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 w-80 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('itinerary.agenda', 'Agenda')}</h2>
        {destination && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{destination.name || destination.city_name}</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Accommodation Section */}
        {accommodation && (
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center mb-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 mr-3">
                <Building2 className="w-4 h-4 text-[#D97706] dark:text-amber-400" />
              </div>
              <h3 className="font-medium text-gray-900 dark:text-white">{t('itinerary.accommodationDefault')}</h3>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-2">
              <h4 className="font-medium text-gray-900 dark:text-white">{accommodation.name}</h4>

              {accommodation.address && (
                <div className="flex items-start text-sm text-gray-600 dark:text-gray-300">
                  <MapPin className="w-3.5 h-3.5 mr-2 mt-0.5 flex-shrink-0 text-gray-400 dark:text-gray-500" />
                  <span>{accommodation.address}</span>
                </div>
              )}

              <div className="flex flex-wrap gap-3 pt-2">
                {accommodation.checkIn && (
                  <div className="flex items-center text-xs">
                    <span className="text-gray-500 dark:text-gray-400 mr-1">{t('accommodation.checkIn')}:</span>
                    <span className="font-medium text-gray-700 dark:text-gray-200">{accommodation.checkIn}</span>
                  </div>
                )}
                {accommodation.checkOut && (
                  <div className="flex items-center text-xs">
                    <span className="text-gray-500 dark:text-gray-400 mr-1">{t('accommodation.checkOut')}:</span>
                    <span className="font-medium text-gray-700 dark:text-gray-200">{accommodation.checkOut}</span>
                  </div>
                )}
              </div>

              {accommodation.notes && (
                <p className="text-xs text-gray-500 dark:text-gray-400 pt-1 border-t border-gray-200 dark:border-gray-600 mt-2">
                  {accommodation.notes}
                </p>
              )}
            </div>
          </div>
        )}

        {/* POIs by Category */}
        <div className="p-4">
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">{t('poi.title')}</h3>

          {pois.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic">{t('poi.noPois')}</p>
          ) : (
            <div className="space-y-3">
              {pois.map((categoryGroup) => {
                const CategoryIcon = categoryIcons[categoryGroup.category] || MapPin;
                const categoryColor = getCategoryColor(categoryGroup.category);
                const isExpanded = expandedCategories[categoryGroup.category] !== false;
                const selectedCount = categoryGroup.pois.filter((p) => isPOISelected(p.id)).length;

                return (
                  <div key={categoryGroup.category} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    {/* Category Header */}
                    <button
                      onClick={() => toggleCategory(categoryGroup.category)}
                      className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="flex items-center">
                        <div className={`p-1.5 rounded-md ${categoryColor} mr-2`}>
                          <CategoryIcon className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-medium text-gray-900 dark:text-white text-sm">
                          {categoryGroup.category}
                        </span>
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                          ({categoryGroup.pois.length})
                        </span>
                        {selectedCount > 0 && (
                          <span className="ml-2 px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-[#D97706] rounded">
                            {selectedCount} {t('common.selected', 'selected')}
                          </span>
                        )}
                      </div>
                      <ChevronDown className={`w-4 h-4 text-gray-400 chevron-animate ${isExpanded ? 'rotated' : ''}`} />
                    </button>

                    {/* POI List */}
                    <div className={`accordion-content ${isExpanded ? 'expanded' : ''}`}>
                      <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {categoryGroup.pois.map((poi) => {
                          const selected = isPOISelected(poi.id);

                          return (
                            <div
                              key={poi.id}
                              onClick={() => handlePOIClick(poi)}
                              className={`
                                p-3 cursor-pointer transition-all
                                ${selected
                                  ? 'bg-amber-50 dark:bg-amber-900/20 border-l-2 border-[#D97706]'
                                  : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 border-l-2 border-transparent'}
                              `}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center">
                                    <h4 className={`font-medium text-sm truncate ${selected ? 'text-amber-900 dark:text-amber-300' : 'text-gray-900 dark:text-white'}`}>
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
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                                      {poi.description}
                                    </p>
                                  )}

                                  {/* POI Details: Cost and Dwell Time */}
                                  <div className="flex items-center gap-3 mt-2">
                                    {poi.estimatedCost !== undefined && (
                                      <div className="flex items-center text-xs text-gray-600 dark:text-gray-400">
                                        <DollarSign className="w-3 h-3 mr-0.5 text-gray-400 dark:text-gray-500" />
                                        <span>{formatCost(poi.estimatedCost, poi.currency)}</span>
                                      </div>
                                    )}
                                    {poi.dwellTime && (
                                      <div className="flex items-center text-xs text-gray-600 dark:text-gray-400">
                                        <ClockIcon className="w-3 h-3 mr-0.5 text-gray-400 dark:text-gray-500" />
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
                                      ? 'bg-[#D97706] border-[#D97706] text-white'
                                      : 'border-gray-300 dark:border-gray-600 hover:border-amber-400 dark:hover:border-amber-500'}
                                  `}
                                  title={selected ? t('itinerary.deselectPoi', 'Deselect POI') : t('itinerary.selectToHighlight', 'Select to highlight on map')}
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
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer with selection summary */}
      {selectedPOIs.length > 0 && (
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-amber-50 dark:bg-amber-900/20">
          <p className="text-xs text-[#D97706] dark:text-amber-400">
            <span className="font-medium">{selectedPOIs.length}</span> {t('itinerary.highlightedOnMap')}
          </p>
        </div>
      )}
    </div>
  );
};

export default Agenda;
