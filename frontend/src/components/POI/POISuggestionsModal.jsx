import React, { useState, useEffect } from 'react';
import {
  X,
  Star,
  MapPin,
  Clock,
  DollarSign,
  Plus,
  Sparkles,
  Filter,
  Loader2,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import usePOIStore from '../../stores/usePOIStore';

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All Categories' },
  { value: 'Sights', label: 'Sights & Landmarks' },
  { value: 'Museums', label: 'Museums & Culture' },
  { value: 'Food', label: 'Food & Dining' },
  { value: 'Nature', label: 'Nature & Parks' },
  { value: 'Entertainment', label: 'Entertainment' },
  { value: 'Shopping', label: 'Shopping' },
  { value: 'Viewpoints', label: 'Viewpoints' },
];

const TRIP_TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'romantic', label: 'Romantic' },
  { value: 'adventure', label: 'Adventure' },
  { value: 'family', label: 'Family' },
  { value: 'cultural', label: 'Cultural' },
  { value: 'food', label: 'Food & Dining' },
  { value: 'nature', label: 'Nature' },
  { value: 'shopping', label: 'Shopping' },
];

const PRICE_LEVEL_LABELS = {
  0: 'Free',
  1: '$',
  2: '$$',
  3: '$$$',
  4: '$$$$',
};

const SuggestedPOICard = ({ suggestion, onAdd, isAdding, isAdded }) => {
  const { metadata, name, category, address, distance_km, estimated_cost, suggested_dwell_time } = suggestion;
  const rating = metadata?.rating;
  const ratingCount = metadata?.user_ratings_total;
  const priceLevel = metadata?.price_level;
  const photos = metadata?.photos || [];
  const photoUrl = photos.length > 0 ? photos[0].url : null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-shadow">
      {/* Photo */}
      {photoUrl && (
        <div className="h-48 bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <img
            src={photoUrl}
            alt={name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {/* Title & Category */}
        <div className="mb-2">
          <h3 className="font-semibold text-gray-900 dark:text-white text-lg mb-1 line-clamp-2">
            {name}
          </h3>
          <span className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 rounded">
            {category}
          </span>
        </div>

        {/* Rating & Price */}
        <div className="flex items-center gap-4 mb-3 text-sm">
          {rating && (
            <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <Star className="w-4 h-4 fill-current" />
              <span className="font-medium">{rating.toFixed(1)}</span>
              {ratingCount && (
                <span className="text-gray-500 dark:text-gray-400">({ratingCount})</span>
              )}
            </div>
          )}
          {priceLevel !== undefined && priceLevel !== null && (
            <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
              <DollarSign className="w-4 h-4" />
              <span className="font-medium">{PRICE_LEVEL_LABELS[priceLevel]}</span>
            </div>
          )}
        </div>

        {/* Address */}
        {address && (
          <div className="flex items-start gap-2 mb-3 text-sm text-gray-600 dark:text-gray-400">
            <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span className="line-clamp-2">{address}</span>
          </div>
        )}

        {/* Distance & Dwell Time */}
        <div className="flex items-center gap-4 mb-4 text-sm text-gray-600 dark:text-gray-400">
          {distance_km !== null && distance_km !== undefined && (
            <div className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              <span>{distance_km} km away</span>
            </div>
          )}
          {suggested_dwell_time && (
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>{suggested_dwell_time} min</span>
            </div>
          )}
        </div>

        {/* Add Button */}
        <button
          onClick={() => onAdd(suggestion)}
          disabled={isAdding || isAdded}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            isAdded
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 cursor-not-allowed'
              : isAdding
              ? 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600'
          }`}
        >
          {isAdding ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Adding...</span>
            </>
          ) : isAdded ? (
            <>
              <CheckCircle className="w-4 h-4" />
              <span>Added</span>
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              <span>Add to Trip</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

const POISuggestionsModal = ({ isOpen, onClose, destinationId, destinationName }) => {
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

  // Fetch suggestions when modal opens
  useEffect(() => {
    if (isOpen && destinationId) {
      loadSuggestions();
    }
  }, [isOpen, destinationId]);

  const loadSuggestions = async () => {
    const params = {
      radius,
      category_filter: categoryFilter !== 'all' ? categoryFilter : null,
      trip_type: tripTypeFilter !== 'all' ? tripTypeFilter : null,
      max_results: 20,
    };
    await fetchPOISuggestions(destinationId, params);
  };

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

  const handleApplyFilters = () => {
    loadSuggestions();
    setShowFilters(false);
  };

  if (!isOpen) return null;

  const filteredSuggestions = suggestions || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Discover POIs
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Popular attractions near {destinationName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <Filter className="w-4 h-4" />
            <span className="font-medium">Filters</span>
          </button>

          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {filteredSuggestions.length} suggestions found
            </span>
            <button
              onClick={handleAddAll}
              disabled={isAddingAll || filteredSuggestions.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {isAddingAll ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Adding All...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Add All</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Category
                </label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  {CATEGORY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Trip Type
                </label>
                <select
                  value={tripTypeFilter}
                  onChange={(e) => setTripTypeFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  {TRIP_TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Search Radius
                </label>
                <select
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
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
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Apply Filters
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isFetchingSuggestions ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 text-blue-600 dark:text-blue-400 animate-spin mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Loading suggestions...</p>
            </div>
          ) : suggestionsError ? (
            <div className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="w-12 h-12 text-red-600 dark:text-red-400 mb-4" />
              <p className="text-gray-900 dark:text-white font-medium mb-2">Failed to load suggestions</p>
              <p className="text-gray-600 dark:text-gray-400 text-sm">{suggestionsError}</p>
              <button
                onClick={loadSuggestions}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : filteredSuggestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Sparkles className="w-12 h-12 text-gray-400 dark:text-gray-600 mb-4" />
              <p className="text-gray-600 dark:text-gray-400">No suggestions found</p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                Try adjusting your filters
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSuggestions.map((suggestion) => (
                <SuggestedPOICard
                  key={suggestion.external_id}
                  suggestion={suggestion}
                  onAdd={handleAddPOI}
                  isAdding={addingPOIs.has(suggestion.external_id)}
                  isAdded={addedPOIs.has(suggestion.external_id)}
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
