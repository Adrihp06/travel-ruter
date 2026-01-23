import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, MapPin, Star, X, Loader2, Utensils, Camera, Hotel } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const CATEGORIES = [
  { id: 'all', label: 'All', icon: Search },
  { id: 'restaurant', label: 'Restaurants', icon: Utensils, types: 'restaurant' },
  { id: 'tourist_attraction', label: 'Attractions', icon: Camera, types: 'tourist_attraction' },
  { id: 'lodging', label: 'Hotels', icon: Hotel, types: 'lodging' },
];

const QuickPOISearch = ({ 
  onSelect, 
  location = null, 
  radius = 5000,
  className = "" 
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [recentSearches, setRecentSearches] = useState(() => {
    const saved = localStorage.getItem('recent_poi_searches');
    return saved ? JSON.parse(saved) : [];
  });

  const wrapperRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchPlaces = useCallback(async (searchQuery, categoryId) => {
    if (searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      let url = `${API_BASE_URL}/google-places/autocomplete?q=${encodeURIComponent(searchQuery)}`;
      
      if (location) {
        url += `&location=${location.lat},${location.lng}&radius=${radius}`;
      }
      
      const category = CATEGORIES.find(c => c.id === categoryId);
      if (category && category.types) {
        url += `&types=${category.types}`;
      }

      const response = await fetch(url);
      if (!response.ok) throw new Error('Search failed');
      const data = await response.json();
      setResults(data.results || []);
      setShowDropdown(true);
    } catch (err) {
      console.error('POI search error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [location, radius]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    
    if (value.length >= 2) {
      debounceRef.current = setTimeout(() => {
        searchPlaces(value, activeCategory);
      }, 300);
    } else {
      setResults([]);
      setShowDropdown(value.length > 0);
    }
  };

  const handleCategoryChange = (categoryId) => {
    setActiveCategory(categoryId);
    if (query.length >= 2) {
      searchPlaces(query, categoryId);
    }
  };

  const handleSelectResult = async (result) => {
    setQuery(result.main_text);
    setShowDropdown(false);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/google-places/details/${result.place_id}`);
      if (!response.ok) throw new Error('Failed to get details');
      const details = await response.json();
      
      // Save to recent searches
      const newRecent = [
        { place_id: result.place_id, main_text: result.main_text, secondary_text: result.secondary_text },
        ...recentSearches.filter(s => s.place_id !== result.place_id)
      ].slice(0, 5);
      
      setRecentSearches(newRecent);
      localStorage.setItem('recent_poi_searches', JSON.stringify(newRecent));
      
      onSelect(details);
    } catch (err) {
      console.error('Detail fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setShowDropdown(false);
  };

  return (
    <div ref={wrapperRef} className={`relative w-full max-w-md ${className}`}>
      <div className="flex flex-col gap-2">
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            {isLoading ? (
              <Loader2 className="h-4 w-4 text-indigo-500 animate-spin" />
            ) : (
              <Search className="h-4 w-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
            )}
          </div>
          <input
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={() => setShowDropdown(true)}
            placeholder="Search restaurants, attractions..."
            className="w-full pl-10 pr-10 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-gray-900 dark:text-white transition-all"
          />
          {query && (
            <button
              onClick={clearSearch}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Category Filters */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => handleCategoryChange(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  activeCategory === cat.id
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 shadow-sm'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Results Dropdown */}
      {showDropdown && (results.length > 0 || (query.length === 0 && recentSearches.length > 0)) && (
        <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="max-h-80 overflow-y-auto">
            {query.length === 0 && recentSearches.length > 0 && (
              <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900/50 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Recent Searches
              </div>
            )}
            
            {(query.length === 0 ? recentSearches : results).map((result) => (
              <button
                key={result.place_id}
                onClick={() => handleSelectResult(result)}
                className="w-full flex items-start gap-3 px-4 py-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-left transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0"
              >
                <div className="mt-1 p-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400">
                  <MapPin className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {result.main_text}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {result.secondary_text}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default QuickPOISearch;
