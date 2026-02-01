import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Filter,
  X,
  ChevronDown,
  ArrowUpDown,
  Eye,
  EyeOff,
  Sparkles
} from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses', color: 'stone' },
  { value: 'planning', label: 'Planning', color: 'amber' },
  { value: 'booked', label: 'Booked', color: 'emerald' },
  { value: 'completed', label: 'Completed', color: 'blue' },
  { value: 'cancelled', label: 'Cancelled', color: 'red' },
];

const SORT_OPTIONS = [
  { value: 'default', label: 'Default (Status Priority)', icon: '⚡' },
  { value: 'date_asc', label: 'Date (Earliest First)', icon: '📅' },
  { value: 'date_desc', label: 'Date (Latest First)', icon: '📆' },
  { value: 'name_asc', label: 'Name (A-Z)', icon: '🔤' },
  { value: 'name_desc', label: 'Name (Z-A)', icon: '🔠' },
  { value: 'modified', label: 'Recently Modified', icon: '🕐' },
];

const TripSearchFilter = ({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  sortBy,
  onSortChange,
  showCompleted,
  onShowCompletedChange,
  activeFiltersCount,
  onClearFilters,
}) => {
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const filterRef = useRef(null);
  const sortRef = useRef(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setShowFilterDropdown(false);
      }
      if (sortRef.current && !sortRef.current.contains(event.target)) {
        setShowSortDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getStatusLabel = (value) => {
    return STATUS_OPTIONS.find(opt => opt.value === value)?.label || 'All Statuses';
  };

  return (
    <div className="space-y-4">
      {/* Main search bar container */}
      <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-md border border-stone-200/50 dark:border-stone-700/50 p-3 sm:p-4 transition-all hover:shadow-lg">
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Search input - Enhanced */}
          <div className="relative flex-1 group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors">
              <Search className="w-5 h-5 text-stone-400 group-focus-within:text-amber-500 dark:group-focus-within:text-amber-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search trips by name, location, or date..."
              className="w-full pl-12 pr-12 py-3.5 border-2 border-stone-200 dark:border-stone-600 rounded-xl bg-stone-50 dark:bg-stone-700/50 text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-stone-500 focus:border-amber-500 dark:focus:border-amber-400 focus:bg-white dark:focus:bg-stone-700 focus:ring-0 focus:outline-none transition-all text-base"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-600 rounded-lg transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter controls container */}
          <div className="flex flex-wrap sm:flex-nowrap gap-2 lg:gap-3">
            {/* Status filter dropdown */}
            <div className="relative flex-1 sm:flex-none" ref={filterRef}>
              <button
                onClick={() => {
                  setShowFilterDropdown(!showFilterDropdown);
                  setShowSortDropdown(false);
                }}
                className={`w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${
                  statusFilter !== 'all'
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md hover:shadow-lg'
                    : 'bg-stone-100 dark:bg-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-600'
                }`}
              >
                <Filter className="w-4 h-4" />
                <span className="hidden sm:inline whitespace-nowrap">{getStatusLabel(statusFilter)}</span>
                <span className="sm:hidden">Filter</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showFilterDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showFilterDropdown && (
                <div className="absolute left-0 sm:right-0 sm:left-auto mt-2 w-56 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl shadow-xl z-30 overflow-hidden animate-scale-fade">
                  <div className="p-2">
                    <div className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider px-3 py-2">
                      Filter by Status
                    </div>
                    {STATUS_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          onStatusChange(option.value);
                          setShowFilterDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-2.5 text-sm rounded-lg transition-all flex items-center gap-3 ${
                          statusFilter === option.value
                            ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-medium'
                            : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${
                          option.value === 'all' ? 'bg-stone-400' :
                          option.value === 'planning' ? 'bg-amber-500' :
                          option.value === 'booked' ? 'bg-emerald-500' :
                          option.value === 'completed' ? 'bg-blue-500' :
                          'bg-red-500'
                        }`} />
                        {option.label}
                        {statusFilter === option.value && (
                          <Sparkles className="w-3 h-3 ml-auto text-amber-500" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sort dropdown */}
            <div className="relative flex-1 sm:flex-none" ref={sortRef}>
              <button
                onClick={() => {
                  setShowSortDropdown(!showSortDropdown);
                  setShowFilterDropdown(false);
                }}
                className={`w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${
                  sortBy !== 'default'
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md hover:shadow-lg'
                    : 'bg-stone-100 dark:bg-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-600'
                }`}
              >
                <ArrowUpDown className="w-4 h-4" />
                <span className="hidden sm:inline">Sort</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showSortDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showSortDropdown && (
                <div className="absolute left-0 sm:right-0 sm:left-auto mt-2 w-64 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl shadow-xl z-30 overflow-hidden animate-scale-fade">
                  <div className="p-2">
                    <div className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider px-3 py-2">
                      Sort By
                    </div>
                    {SORT_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          onSortChange(option.value);
                          setShowSortDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-2.5 text-sm rounded-lg transition-all flex items-center gap-3 ${
                          sortBy === option.value
                            ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-medium'
                            : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700'
                        }`}
                      >
                        <span className="text-base">{option.icon}</span>
                        {option.label}
                        {sortBy === option.value && (
                          <Sparkles className="w-3 h-3 ml-auto text-amber-500" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Show completed toggle */}
            <button
              onClick={() => onShowCompletedChange(!showCompleted)}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${
                showCompleted
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-md hover:shadow-lg'
                  : 'bg-stone-100 dark:bg-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-600'
              }`}
              title={showCompleted ? 'Hide completed trips' : 'Show completed trips'}
            >
              {showCompleted ? (
                <Eye className="w-4 h-4" />
              ) : (
                <EyeOff className="w-4 h-4" />
              )}
              <span className="hidden md:inline">Completed</span>
            </button>
          </div>
        </div>

        {/* Active filters bar */}
        {activeFiltersCount > 0 && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-stone-200 dark:border-stone-700">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full text-sm font-medium">
                <Sparkles className="w-3.5 h-3.5" />
                {activeFiltersCount} filter{activeFiltersCount > 1 ? 's' : ''} active
              </span>
            </div>
            <button
              onClick={onClearFilters}
              className="flex items-center gap-1.5 text-sm text-stone-600 dark:text-stone-400 hover:text-amber-600 dark:hover:text-amber-400 font-medium transition-colors"
            >
              <X className="w-4 h-4" />
              Clear all
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TripSearchFilter;
