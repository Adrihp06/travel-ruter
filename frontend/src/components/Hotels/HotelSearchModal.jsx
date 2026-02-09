import React, { useState, useEffect, useCallback, useId } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MapPin,
  SlidersHorizontal,
  Building2,
} from 'lucide-react';
import XIcon from '@/components/icons/x-icon';
import MagnifierIcon from '@/components/icons/magnifier-icon';
import InfoCircleIcon from '@/components/icons/info-circle-icon';
import useHotelSearchStore from '../../stores/useHotelSearchStore';
import HotelCard from './HotelCard';
import HotelDetailModal from './HotelDetailModal';
import Spinner from '../UI/Spinner';

const RADIUS_OPTIONS = [
  { value: 2000, label: '2 km' },
  { value: 5000, label: '5 km' },
  { value: 10000, label: '10 km' },
  { value: 20000, label: '20 km' },
];

const HotelSearchModal = ({
  isOpen,
  onClose,
  destination = null,
  onSelectHotel,
}) => {
  const { t } = useTranslation();
  const titleId = useId();
  const {
    searchResults,
    selectedHotel,
    isSearching,
    searchError,
    filters,
    setSearchParams,
    setFilters,
    searchHotels,
    selectHotel,
    clearSearch,
    clearErrors,
  } = useHotelSearchStore();

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [radius, setRadius] = useState(5000);

  // Sort options
  const sortOptions = [
    { value: 'relevance', labelKey: 'hotels.relevance' },
    { value: 'rating', labelKey: 'hotels.highestRated' },
  ];

  // Auto-search on mount if destination has coordinates
  useEffect(() => {
    if (isOpen && destination?.latitude && destination?.longitude) {
      setSearchParams({
        latitude: destination.latitude,
        longitude: destination.longitude,
      });

      const timer = setTimeout(() => {
        searchHotels({
          latitude: destination.latitude,
          longitude: destination.longitude,
          radius,
          keyword: keyword || undefined,
        });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle search
  const handleSearch = useCallback(async () => {
    if (!destination?.latitude || !destination?.longitude) {
      return;
    }

    await searchHotels({
      latitude: destination.latitude,
      longitude: destination.longitude,
      radius,
      keyword: keyword || undefined,
    });
  }, [destination, radius, keyword, searchHotels]);

  const handleClose = () => {
    clearSearch();
    clearErrors();
    setKeyword('');
    setRadius(5000);
    onClose();
  };

  const handleHotelClick = (hotel) => {
    selectHotel(hotel);
    setShowDetailModal(true);
  };

  const handleHotelSelect = (data) => {
    setShowDetailModal(false);
    onSelectHotel?.(data);
    handleClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#D97706] dark:text-amber-400" />
              <h2 id={titleId} className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('hotels.searchNearby')}
              </h2>
            </div>
            <button
              onClick={handleClose}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              aria-label={t('hotels.closeModal')}
            >
              <XIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          {/* Search Form */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-4 flex-shrink-0">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Location (read-only) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <MapPin className="w-3 h-3 inline mr-1" />
                  {t('hotels.location')}
                </label>
                <input
                  type="text"
                  value={destination?.name || destination?.city || 'Unknown'}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 text-sm cursor-not-allowed"
                />
              </div>

              {/* Keyword */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <MagnifierIcon className="w-3 h-3 inline mr-1" />
                  {t('hotels.keyword')}
                </label>
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#D97706]/50 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  placeholder={t('hotels.keywordPlaceholder')}
                />
              </div>

              {/* Radius */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <SlidersHorizontal className="w-3 h-3 inline mr-1" />
                  {t('hotels.searchRadius')}
                </label>
                <select
                  value={radius}
                  onChange={(e) => setRadius(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#D97706]/50 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  {RADIUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Search Button & Sort */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleSearch}
                disabled={isSearching || !destination?.latitude}
                className="px-4 py-2 bg-[#D97706] text-white rounded-lg hover:bg-[#B45309] disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {isSearching ? (
                  <>
                    <Spinner className="w-4 h-4" />
                    {t('hotels.searching')}
                  </>
                ) : (
                  <>
                    <MagnifierIcon className="w-4 h-4" />
                    {t('hotels.searchHotels')}
                  </>
                )}
              </button>

              {/* Sort dropdown */}
              <select
                value={filters.sortBy}
                onChange={(e) => setFilters({ sortBy: e.target.value })}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm"
              >
                {sortOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* Error State */}
            {searchError && (
              <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg mb-4">
                <InfoCircleIcon className="w-5 h-5 flex-shrink-0" />
                <span>{searchError}</span>
              </div>
            )}

            {/* Loading State */}
            {isSearching && (
              <div className="flex flex-col items-center justify-center py-12">
                <Spinner className="w-8 h-8 mb-3" />
                <p className="text-gray-500 dark:text-gray-400">{t('hotels.searchingNearby')}</p>
              </div>
            )}

            {/* Empty State */}
            {!isSearching && searchResults.length === 0 && !searchError && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Building2 className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
                  {t('hotels.discoverNearby')}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-md">
                  {destination?.latitude
                    ? t('hotels.clickSearchHotels')
                    : t('hotels.noCoordinates')}
                </p>
              </div>
            )}

            {/* Results Grid */}
            {!isSearching && searchResults.length > 0 && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('hotels.hotelsFound', { count: searchResults.length })}
                  </p>
                </div>
                <div className="space-y-4">
                  {searchResults.map((hotel, index) => (
                    <HotelCard
                      key={hotel.place_id || index}
                      hotel={hotel}
                      onClick={() => handleHotelClick(hotel)}
                      isSelected={selectedHotel?.place_id === hotel.place_id}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Hotel Detail Modal */}
      <HotelDetailModal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        onSelectHotel={handleHotelSelect}
      />
    </>
  );
};

export default HotelSearchModal;
