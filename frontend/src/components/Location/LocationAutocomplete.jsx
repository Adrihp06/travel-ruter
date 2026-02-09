import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import XIcon from '@/components/icons/x-icon';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const SETTINGS_KEY = 'travel-ruter-settings';

const getGeocodingProvider = () => {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const settings = JSON.parse(stored);
      return settings.geocoding?.provider || 'nominatim';
    }
  } catch {
    // Ignore parse errors
  }
  return 'nominatim';
};

const LocationAutocomplete = ({
  value = '',
  latitude = null,
  longitude = null,
  onChange,
  onSelect,
  placeholder = 'Search for a location...',
  className = '',
  error = null,
}) => {
  const [inputValue, setInputValue] = useState(value);
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(
    latitude && longitude ? { latitude, longitude, display_name: value } : null
  );
  const wrapperRef = useRef(null);
  const debounceRef = useRef(null);

  // Sync with external value changes
  useEffect(() => {
    setInputValue(value);
    if (latitude && longitude) {
      setSelectedLocation({ latitude, longitude, display_name: value });
    } else {
      setSelectedLocation(null);
    }
  }, [value, latitude, longitude]);

  // Close dropdown when clicking outside and cleanup debounce on unmount
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      // Cleanup debounce timer to prevent memory leak and setState on unmounted component
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const searchLocations = useCallback(async (query) => {
    if (query.length < 2) {
      setSuggestions([]);
      setSearchError(null);
      return;
    }

    setIsLoading(true);
    setSearchError(null);
    try {
      const provider = getGeocodingProvider();
      const response = await fetch(
        `${API_BASE_URL}/geocoding/search?q=${encodeURIComponent(query)}&limit=5&provider=${provider}`
      );
      if (!response.ok) throw new Error('Search failed');
      const data = await response.json();
      setSuggestions(data.results || []);
      setShowDropdown(true);
    } catch (err) {
      console.error('Geocoding search error:', err);
      setSuggestions([]);
      setSearchError('Unable to search locations. Check if backend is running.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setSelectedLocation(null);
    setSearchError(null);
    onChange?.(newValue, null, null);

    // Debounce the search
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      searchLocations(newValue);
    }, 300);

    if (newValue.length >= 2) {
      setShowDropdown(true);
    } else {
      setShowDropdown(false);
      setSuggestions([]);
    }
  };

  const handleFocus = () => {
    if (inputValue.length >= 2) {
      if (suggestions.length > 0) {
        setShowDropdown(true);
      } else {
        // Re-trigger search on focus if no cached suggestions
        searchLocations(inputValue);
      }
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setInputValue(suggestion.display_name);
    setSelectedLocation(suggestion);
    setSuggestions([]);
    setShowDropdown(false);

    onSelect?.(suggestion);
    onChange?.(suggestion.display_name, suggestion.latitude, suggestion.longitude);
  };

  const handleClear = () => {
    setInputValue('');
    setSelectedLocation(null);
    setSuggestions([]);
    onChange?.('', null, null);
  };

  const formatDisplayName = (displayName) => {
    // Shorten display name for dropdown
    const parts = displayName.split(', ');
    if (parts.length > 3) {
      return parts.slice(0, 3).join(', ');
    }
    return displayName;
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {isLoading ? (
            <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
          ) : (
            <MapPin className="h-4 w-4 text-gray-400" />
          )}
        </div>
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          className={`w-full pl-10 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-[#D97706]/50 focus:border-[#D97706] text-gray-900 bg-white ${
            error || searchError ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder={placeholder}
        />
        {inputValue && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
          >
            <XIcon className="h-4 w-4 text-gray-400 hover:text-gray-600" />
          </button>
        )}
      </div>

      {/* Suggestions dropdown */}
      {showDropdown && (isLoading || suggestions.length > 0) && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
          {isLoading ? (
            <li className="px-4 py-3 text-gray-500 text-sm flex items-center space-x-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Searching...</span>
            </li>
          ) : (
            suggestions.map((suggestion) => (
              <li
                key={suggestion.place_id}
                onClick={() => handleSuggestionClick(suggestion)}
                className="px-4 py-3 hover:bg-amber-50 cursor-pointer border-b border-gray-100 last:border-b-0"
              >
                <div className="flex items-start space-x-2">
                  <MapPin className="h-4 w-4 text-[#D97706] mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {formatDisplayName(suggestion.display_name)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {suggestion.latitude.toFixed(4)}, {suggestion.longitude.toFixed(4)}
                    </p>
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      )}

      {/* Selected location info */}
      {selectedLocation && (
        <div className="mt-1 text-xs text-gray-500 flex items-center space-x-1">
          <MapPin className="h-3 w-3" />
          <span>
            {selectedLocation.latitude.toFixed(4)}, {selectedLocation.longitude.toFixed(4)}
          </span>
        </div>
      )}

      {(error || searchError) && (
        <p className="text-red-500 text-xs mt-1">{error || searchError}</p>
      )}
    </div>
  );
};

export default LocationAutocomplete;
