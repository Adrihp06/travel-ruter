import React, { useState, useEffect, useRef, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Loader2 } from 'lucide-react';
import XIcon from '@/components/icons/x-icon';
import MagnifierIcon from '@/components/icons/magnifier-icon';
import useTravelStopStore from '../../stores/useTravelStopStore';
import TravelModeSelector from './TravelModeSelector';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const AddTravelStopModal = ({ isOpen, onClose, onSaved, segmentId, existingStop = null }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    latitude: '',
    longitude: '',
    address: '',
    duration_minutes: 60,
    arrival_time: '',
    stop_date: '',
    travel_mode: '',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const { createStop, updateStop } = useTravelStopStore();
  const titleId = useId();

  // Search cache for avoiding redundant API calls
  const searchCache = useRef(new Map());
  const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

  // Pre-fill form if editing existing stop
  useEffect(() => {
    if (existingStop) {
      setFormData({
        name: existingStop.name || '',
        description: existingStop.description || '',
        latitude: existingStop.latitude || '',
        longitude: existingStop.longitude || '',
        address: existingStop.address || '',
        duration_minutes: existingStop.duration_minutes || 60,
        arrival_time: existingStop.arrival_time || '',
        stop_date: existingStop.stop_date || '',
        travel_mode: existingStop.travel_mode || '',
      });
    } else {
      // Reset form for new stop
      setFormData({
        name: '',
        description: '',
        latitude: '',
        longitude: '',
        address: '',
        duration_minutes: 60,
        arrival_time: '',
        stop_date: '',
        travel_mode: '',
      });
    }
    setSearchQuery('');
    setSearchResults([]);
    setError(null);
  }, [existingStop, isOpen]);

  // Search for places with caching
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    const cacheKey = searchQuery.trim().toLowerCase();

    // Check cache first
    const cached = searchCache.current.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY_MS) {
      setSearchResults(cached.results);
      return;
    }

    setIsSearching(true);
    setError(null);
    try {
      const response = await fetch(
        `${API_BASE_URL}/google-places/autocomplete?q=${encodeURIComponent(searchQuery)}`
      );

      if (!response.ok) {
        throw new Error('Failed to search for places');
      }

      const data = await response.json();
      const places = data.results || [];
      setSearchResults(places);

      // Cache the results
      searchCache.current.set(cacheKey, {
        results: places,
        timestamp: Date.now(),
      });
    } catch (err) {
      setError('Search failed. Please enter location manually.');
    } finally {
      setIsSearching(false);
    }
  };

  // Select a search result
  const handleSelectPlace = async (place) => {
    setIsSearching(true);
    try {
      // Fetch place details to get coordinates
      const response = await fetch(
        `${API_BASE_URL}/google-places/details/${place.place_id}`
      );

      if (!response.ok) {
        throw new Error('Failed to get place details');
      }

      const details = await response.json();

      setFormData({
        ...formData,
        name: details.name || place.description,
        address: details.formatted_address || place.description,
        latitude: details.latitude || '',
        longitude: details.longitude || '',
      });
      setSearchResults([]);
      setSearchQuery('');
    } catch (err) {
      // If we can't get details, just use the name
      setFormData({
        ...formData,
        name: place.description,
        address: place.description,
      });
      setSearchResults([]);
      setSearchQuery('');
    } finally {
      setIsSearching(false);
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validate required fields
    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }
    // Validate latitude and longitude with proper null/empty checks and range validation
    const lat = parseFloat(formData.latitude);
    const lng = parseFloat(formData.longitude);

    if (formData.latitude === '' || formData.latitude === null || formData.latitude === undefined || isNaN(lat)) {
      setError('Latitude is required. Please search for a place or enter manually.');
      return;
    }
    if (lat < -90 || lat > 90) {
      setError('Latitude must be between -90 and 90.');
      return;
    }
    if (formData.longitude === '' || formData.longitude === null || formData.longitude === undefined || isNaN(lng)) {
      setError('Longitude is required. Please search for a place or enter manually.');
      return;
    }
    if (lng < -180 || lng > 180) {
      setError('Longitude must be between -180 and 180.');
      return;
    }

    setIsSaving(true);
    try {
      const stopData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        address: formData.address.trim() || null,
        duration_minutes: parseInt(formData.duration_minutes) || 60,
        arrival_time: formData.arrival_time || null,
        stop_date: formData.stop_date || null,
        travel_mode: formData.travel_mode || null,
      };

      if (existingStop) {
        await updateStop(existingStop.id, stopData);
      } else {
        await createStop(segmentId, stopData);
      }

      // Call onSaved if provided (to trigger segment refetch for updated route)
      // Otherwise fall back to onClose
      if (onSaved) {
        onSaved();
      } else {
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to save stop');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      role="presentation"
    >
      <div
        className="bg-white dark:bg-stone-800 rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto mx-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-stone-200 dark:border-stone-700">
          <h3 id={titleId} className="text-lg font-semibold text-stone-900 dark:text-stone-100">
            {existingStop ? t('segments.editStop') : t('segments.addIntermediateStop')}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
            aria-label={t('hotels.closeModal')}
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Place Search */}
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
              {t('segments.searchPlaces')}
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSearch())}
                  placeholder={t('segments.searchPlaceholder')}
                  className="w-full px-3 py-2 pr-8 border border-stone-300 dark:border-stone-600 rounded-lg bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
                {isSearching && (
                  <Loader2 className="absolute right-2 top-2.5 w-4 h-4 text-stone-400 animate-spin" />
                )}
              </div>
              <button
                type="button"
                onClick={handleSearch}
                disabled={isSearching || !searchQuery.trim()}
                className="px-3 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white rounded-lg transition-colors"
              >
                <MagnifierIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="mt-2 border border-stone-200 dark:border-stone-600 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                {searchResults.map((place) => (
                  <button
                    key={place.place_id}
                    type="button"
                    onClick={() => handleSelectPlace(place)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-amber-50 dark:hover:bg-amber-900/20 border-b border-stone-100 dark:border-stone-700 last:border-0"
                  >
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                      <span className="text-stone-700 dark:text-stone-300">{place.description}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
              {t('segments.nameRequired')}
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Matsumoto Castle"
              className="w-full px-3 py-2 border border-stone-300 dark:border-stone-600 rounded-lg bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              required
            />
          </div>

          {/* Coordinates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                {t('segments.latitudeRequired')}
              </label>
              <input
                type="number"
                step="any"
                value={formData.latitude}
                onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                placeholder="36.2380"
                className="w-full px-3 py-2 border border-stone-300 dark:border-stone-600 rounded-lg bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                {t('segments.longitudeRequired')}
              </label>
              <input
                type="number"
                step="any"
                value={formData.longitude}
                onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                placeholder="137.9719"
                className="w-full px-3 py-2 border border-stone-300 dark:border-stone-600 rounded-lg bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
              {t('segments.durationLabel')}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                value={formData.duration_minutes}
                onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })}
                className="w-24 px-3 py-2 border border-stone-300 dark:border-stone-600 rounded-lg bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
              <div className="flex gap-1">
                {[30, 60, 120, 180].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setFormData({ ...formData, duration_minutes: mins })}
                    className={`px-2 py-1 text-xs rounded ${
                      formData.duration_minutes == mins
                        ? 'bg-amber-600 text-white'
                        : 'bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-600'
                    } transition-colors`}
                  >
                    {mins < 60 ? `${mins}m` : `${mins / 60}h`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Travel Mode */}
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
              {t('segments.travelModeToStop')}
            </label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, travel_mode: '' })}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    !formData.travel_mode
                      ? 'bg-stone-200 dark:bg-stone-600 text-stone-800 dark:text-stone-200'
                      : 'bg-stone-100 dark:bg-stone-700 text-stone-500 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-600'
                  }`}
                >
                  {t('segments.inheritFromSegment')}
                </button>
              </div>
              <TravelModeSelector
                compact
                selectedMode={formData.travel_mode}
                onSelectMode={(mode) => setFormData({ ...formData, travel_mode: mode })}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
              {t('segments.descriptionOptional')}
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={t('segments.notesPlaceholder')}
              rows={2}
              className="w-full px-3 py-2 border border-stone-300 dark:border-stone-600 rounded-lg bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 text-sm resize-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-stone-600 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {existingStop ? t('segments.save') : t('segments.addStopButton')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddTravelStopModal;
