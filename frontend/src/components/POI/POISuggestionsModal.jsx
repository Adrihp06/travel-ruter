import React, { useState, useEffect, useCallback, useRef, useId } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MapPin,
  Clock,
  DollarSign,
  Plus,
  Sparkles,
  Filter,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import XIcon from '@/components/icons/x-icon';
import StarIcon from '@/components/icons/star-icon';
import FilledCheckedIcon from '@/components/icons/filled-checked-icon';
import usePOIStore from '../../stores/usePOIStore';

const CATEGORY_OPTIONS = [
  { value: 'all', labelKey: 'poi.filter.allCategories' },
  { value: 'Sights', labelKey: 'poi.filter.sightsLandmarks' },
  { value: 'Museums', labelKey: 'poi.filter.museumsCulture' },
  { value: 'Food', labelKey: 'poi.filter.foodDining' },
  { value: 'Nature', labelKey: 'poi.filter.natureParks' },
  { value: 'Entertainment', labelKey: 'poi.filter.entertainment' },
  { value: 'Shopping', labelKey: 'poi.filter.shopping' },
  { value: 'Viewpoints', labelKey: 'poi.filter.viewpoints' },
];

const TRIP_TYPE_OPTIONS = [
  { value: 'all', labelKey: 'poi.filter.allTypes' },
  { value: 'romantic', labelKey: 'poi.filter.romantic' },
  { value: 'adventure', labelKey: 'poi.filter.adventure' },
  { value: 'family', labelKey: 'poi.filter.family' },
  { value: 'cultural', labelKey: 'poi.filter.cultural' },
  { value: 'food', labelKey: 'poi.filter.foodDining' },
  { value: 'nature', labelKey: 'poi.filter.nature' },
  { value: 'shopping', labelKey: 'poi.filter.shopping' },
];

const PRICE_LEVEL_LABELS = {
  0: 'Free',
  1: '$',
  2: '$$',
  3: '$$$',
  4: '$$$$',
};

// Memoized card component to prevent unnecessary re-renders
const SuggestedPOICard = React.memo(({ suggestion, onAdd, isAdding, isAdded, t }) => {
  const { metadata, name, category, address, distance_km, estimated_cost, suggested_dwell_time } = suggestion;
  const rating = metadata?.rating;
  const ratingCount = metadata?.user_ratings_total;
  const priceLevel = metadata?.price_level;
  const photos = metadata?.photos || [];
  const photoUrl = photos.length > 0 ? photos[0].url : null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 overflow-hidden hover:shadow-xl hover:scale-[1.02] transition-all duration-300 group">
      {/* Photo */}
      {photoUrl && (
        <div className="h-44 bg-gray-200 dark:bg-gray-700 overflow-hidden relative">
          <img
            src={photoUrl}
            alt={name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {/* Title & Category */}
        <div className="mb-3">
          <h3 className="font-semibold text-gray-900 dark:text-white text-base mb-2 line-clamp-2 group-hover:text-[#D97706] dark:group-hover:text-amber-400 transition-colors">
            {name}
          </h3>
          <span className="inline-block px-2.5 py-1 text-xs font-medium bg-amber-100 text-[#D97706] dark:bg-amber-900/40 dark:text-amber-300 rounded-full">
            {category}
          </span>
        </div>

        {/* Rating & Price */}
        <div className="flex items-center gap-3 mb-3 text-sm">
          {rating && (
            <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
              <StarIcon className="w-3.5 h-3.5 fill-current" />
              <span className="font-semibold text-xs">{rating.toFixed(1)}</span>
              {ratingCount && (
                <span className="text-amber-600/60 dark:text-amber-400/60 text-xs">({ratingCount})</span>
              )}
            </div>
          )}
          {priceLevel !== undefined && priceLevel !== null && (
            <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400 text-xs">
              <DollarSign className="w-3.5 h-3.5" />
              <span className="font-medium">{PRICE_LEVEL_LABELS[priceLevel]}</span>
            </div>
          )}
        </div>

        {/* Address */}
        {address && (
          <div className="flex items-start gap-2 mb-3 text-xs text-gray-500 dark:text-gray-400">
            <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-gray-400" />
            <span className="line-clamp-2">{address}</span>
          </div>
        )}

        {/* Distance & Dwell Time */}
        <div className="flex items-center gap-3 mb-4 text-xs text-gray-500 dark:text-gray-400">
          {distance_km !== null && distance_km !== undefined && (
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700/50 px-2 py-1 rounded-full">
              <MapPin className="w-3 h-3" />
              <span>{distance_km} km</span>
            </div>
          )}
          {suggested_dwell_time && (
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700/50 px-2 py-1 rounded-full">
              <Clock className="w-3 h-3" />
              <span>{suggested_dwell_time} min</span>
            </div>
          )}
        </div>

        {/* Add Button */}
        <button
          onClick={() => onAdd(suggestion)}
          disabled={isAdding || isAdded}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
            isAdded
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 cursor-not-allowed'
              : isAdding
              ? 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-[#D97706] to-[#EA580C] text-white hover:from-[#B45309] hover:to-[#C2410C] shadow-sm hover:shadow-md active:scale-[0.98]'
          }`}
        >
          {isAdding ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{t('poi.adding')}</span>
            </>
          ) : isAdded ? (
            <>
              <FilledCheckedIcon className="w-4 h-4" />
              <span>{t('poi.added')}</span>
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              <span>{t('poi.addToTrip')}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
});

const POISuggestionsModal = ({ isOpen, onClose, destinationId, destinationName }) => {
  const { t } = useTranslation();
  const {
    suggestions,
    isFetchingSuggestions,
    suggestionsError,
    fetchPOISuggestions,
    addSuggestedPOI,
    bulkAddSuggestedPOIs,
  } = usePOIStore();

  const [categoryFilter, setCategoryFilter] = useState('all');
  const [tripTypeFilter, setTripTypeFilter] = useState('all');
  const [radius, setRadius] = useState(5000);
  const [showFilters, setShowFilters] = useState(false);
  const [addingPOIs, setAddingPOIs] = useState(new Set());
  const [addedPOIs, setAddedPOIs] = useState(new Set());
  const [isAddingAll, setIsAddingAll] = useState(false);

  // Accessibility IDs
  const titleId = useId();
  const filtersPanelId = useId();

  // Debounce ref for filter changes
  const filterDebounceRef = useRef(null);

  // Memoized loadSuggestions function
  const loadSuggestions = useCallback(async (overrideParams = {}) => {
    if (!destinationId) return;

    const params = {
      radius: overrideParams.radius ?? radius,
      category_filter: (overrideParams.categoryFilter ?? categoryFilter) !== 'all'
        ? (overrideParams.categoryFilter ?? categoryFilter)
        : null,
      trip_type: (overrideParams.tripTypeFilter ?? tripTypeFilter) !== 'all'
        ? (overrideParams.tripTypeFilter ?? tripTypeFilter)
        : null,
      max_results: 20,
    };
    await fetchPOISuggestions(destinationId, params);
  }, [destinationId, radius, categoryFilter, tripTypeFilter, fetchPOISuggestions]);

  // Fetch suggestions when modal opens and reset state
  useEffect(() => {
    if (isOpen && destinationId) {
      // Reset state when modal opens with a new destination
      setAddingPOIs(new Set());
      setAddedPOIs(new Set());
      setShowFilters(false);
      // Load suggestions with current filter values
      loadSuggestions();
    }
  }, [isOpen, destinationId, loadSuggestions]);

  const handleAddPOI = async (suggestion) => {
    if (addingPOIs.has(suggestion.external_id) || addedPOIs.has(suggestion.external_id)) {
      return;
    }

    setAddingPOIs(prev => new Set(prev).add(suggestion.external_id));

    try {
      const poiData = {
        destination_id: destinationId,
        name: suggestion.name,
        category: suggestion.category,
        address: suggestion.address,
        latitude: suggestion.latitude,
        longitude: suggestion.longitude,
        external_id: suggestion.external_id,
        external_source: suggestion.external_source,
        estimated_cost: suggestion.estimated_cost,
        dwell_time: suggestion.suggested_dwell_time,
        metadata_json: suggestion.metadata,
      };

      await addSuggestedPOI(poiData);
      setAddedPOIs(prev => new Set(prev).add(suggestion.external_id));
    } catch (error) {
      console.error('Failed to add POI:', error);
    } finally {
      setAddingPOIs(prev => {
        const next = new Set(prev);
        next.delete(suggestion.external_id);
        return next;
      });
    }
  };

  const handleAddAll = async () => {
    if (!suggestions || suggestions.length === 0 || isAddingAll) {
      return;
    }

    setIsAddingAll(true);

    try {
      // Filter out already added POIs
      const notAddedSuggestions = suggestions.filter(
        s => !addedPOIs.has(s.external_id)
      );

      if (notAddedSuggestions.length === 0) {
        return;
      }

      const placeIds = notAddedSuggestions.map(s => s.external_id);
      await bulkAddSuggestedPOIs(destinationId, placeIds);

      // Mark all as added
      setAddedPOIs(prev => {
        const next = new Set(prev);
        placeIds.forEach(id => next.add(id));
        return next;
      });
    } catch (error) {
      console.error('Failed to add all POIs:', error);
    } finally {
      setIsAddingAll(false);
    }
  };

  const handleApplyFilters = useCallback(() => {
    // Debounce filter API calls
    if (filterDebounceRef.current) {
      clearTimeout(filterDebounceRef.current);
    }
    filterDebounceRef.current = setTimeout(() => {
      loadSuggestions({
        radius,
        categoryFilter,
        tripTypeFilter,
      });
      setShowFilters(false);
    }, 300);
  }, [loadSuggestions, radius, categoryFilter, tripTypeFilter]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (filterDebounceRef.current) {
        clearTimeout(filterDebounceRef.current);
      }
    };
  }, []);

  if (!isOpen) return null;

  const filteredSuggestions = suggestions || [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop bg-black/40 p-4"
      role="presentation"
    >
      <div
        className="modal-content bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col border border-gray-200/50 dark:border-gray-700/50 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        {/* Header */}
        <div className="modal-header flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="modal-icon-container primary w-12 h-12 rounded-xl">
              <Sparkles className="w-6 h-6 text-[#D97706] dark:text-amber-400" />
            </div>
            <div>
              <h2 id={titleId} className="text-xl font-bold text-gray-900 dark:text-white">
                {t('poi.discoverPOIs')}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('poi.popularAttractionsNear', { destination: destinationName })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="modal-close-btn p-2.5 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label={t('common.close')}
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-4 bg-gray-50/50 dark:bg-gray-800/30">
          <button
            onClick={() => setShowFilters(!showFilters)}
            aria-expanded={showFilters}
            aria-controls={filtersPanelId}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all ${
              showFilters
                ? 'bg-amber-100 text-[#D97706] dark:bg-amber-900/30 dark:text-amber-300 ring-2 ring-amber-500/30'
                : 'border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>{t('poi.filters')}</span>
          </button>

          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-full">
              {t('poi.suggestionsCount', { count: filteredSuggestions.length })}
            </span>
            <button
              onClick={handleAddAll}
              disabled={isAddingAll || filteredSuggestions.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#D97706] to-[#EA580C] text-white rounded-xl hover:from-[#B45309] hover:to-[#C2410C] disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all font-medium text-sm shadow-sm hover:shadow-md active:scale-[0.98]"
            >
              {isAddingAll ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('poi.addingAll')}</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>{t('poi.addAll')}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div
            id={filtersPanelId}
            className="px-6 py-4 bg-gradient-to-b from-gray-50 to-white dark:from-gray-800/50 dark:to-gray-900/50 border-b border-gray-200 dark:border-gray-700 animate-slide-up"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="modal-label">
                  {t('poi.category')}
                </label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="modal-input w-full px-4 py-2.5 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white cursor-pointer"
                >
                  {CATEGORY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="modal-label">
                  {t('poi.tripType')}
                </label>
                <select
                  value={tripTypeFilter}
                  onChange={(e) => setTripTypeFilter(e.target.value)}
                  className="modal-input w-full px-4 py-2.5 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white cursor-pointer"
                >
                  {TRIP_TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="modal-label">
                  {t('poi.searchRadius')}
                </label>
                <select
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                  className="modal-input w-full px-4 py-2.5 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white cursor-pointer"
                >
                  <option value={1000}>1 km</option>
                  <option value={2000}>2 km</option>
                  <option value={5000}>5 km</option>
                  <option value={10000}>10 km</option>
                  <option value={25000}>25 km</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={handleApplyFilters}
                className="modal-btn modal-btn-primary"
              >
                {t('poi.applyFilters')}
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30 dark:bg-gray-900/30">
          {isFetchingSuggestions ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-amber-200 dark:border-amber-900 rounded-full"></div>
                <div className="absolute top-0 left-0 w-16 h-16 border-4 border-[#D97706] dark:border-amber-400 rounded-full animate-spin border-t-transparent"></div>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mt-4 font-medium">{t('poi.loadingSuggestions')}</p>
              <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">{t('poi.findingBestPlaces')}</p>
            </div>
          ) : suggestionsError ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="modal-icon-container danger w-16 h-16 rounded-2xl mb-4">
                <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              <p className="text-gray-900 dark:text-white font-semibold mb-1">{t('poi.failedToLoadSuggestions')}</p>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">{suggestionsError}</p>
              <button
                onClick={loadSuggestions}
                className="modal-btn modal-btn-primary"
              >
                {t('common.tryAgain')}
              </button>
            </div>
          ) : filteredSuggestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-gray-400 dark:text-gray-600" />
              </div>
              <p className="text-gray-700 dark:text-gray-300 font-medium">{t('poi.noSuggestionsFound')}</p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                {t('poi.tryAdjustingFilters')}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredSuggestions.map((suggestion) => (
                <SuggestedPOICard
                  key={suggestion.external_id}
                  suggestion={suggestion}
                  onAdd={handleAddPOI}
                  isAdding={addingPOIs.has(suggestion.external_id)}
                  isAdded={addedPOIs.has(suggestion.external_id)}
                  t={t}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default POISuggestionsModal;
