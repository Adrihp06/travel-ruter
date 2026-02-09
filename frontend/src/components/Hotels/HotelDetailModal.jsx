import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MapPin,
  ChevronLeft,
  Bed,
  Map,
} from 'lucide-react';
import XIcon from '@/components/icons/x-icon';
import StarIcon from '@/components/icons/star-icon';
import TelephoneIcon from '@/components/icons/telephone-icon';
import GlobeIcon from '@/components/icons/globe-icon';
import RightChevron from '@/components/icons/right-chevron';
import InfoCircleIcon from '@/components/icons/info-circle-icon';
import CheckedIcon from '@/components/icons/checked-icon';
import useHotelSearchStore from '../../stores/useHotelSearchStore';
import Spinner from '../UI/Spinner';

const HotelDetailModal = ({ isOpen, onClose, onSelectHotel }) => {
  const { t } = useTranslation();
  const {
    selectedHotel,
    hotelDetails,
    isLoadingDetails,
    detailsError,
    getHotelDetails,
    clearSelectedHotel,
  } = useHotelSearchStore();

  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Fetch details when modal opens
  useEffect(() => {
    if (isOpen && selectedHotel?.place_id) {
      getHotelDetails(selectedHotel.place_id);
      setCurrentImageIndex(0);
    }
  }, [isOpen, selectedHotel?.place_id, getHotelDetails]);

  const handleClose = () => {
    clearSelectedHotel();
    onClose();
  };

  const handleSelectHotel = () => {
    // Use details if loaded, otherwise fall back to search result data
    const data = hotelDetails || selectedHotel;
    if (!data) return;

    const photos = (data.photos || []).map(p => p.url).filter(Boolean);

    onSelectHotel?.({
      accommodationData: {
        name: data.name,
        type: 'hotel',
        address: data.formatted_address || data.address || '',
        latitude: data.latitude,
        longitude: data.longitude,
        external_id: data.place_id || selectedHotel?.place_id,
        provider: 'google_places',
        photos,
        review_score: data.rating,
        review_count: data.user_ratings_total,
      },
    });
    handleClose();
  };

  if (!isOpen || !selectedHotel) return null;

  // Use details if loaded, otherwise fall back to search result data
  const hotel = hotelDetails || selectedHotel;
  const name = hotel.name || 'Hotel';
  const rating = hotel.rating || 0;
  const photos = hotel.photos || [];
  const address = hotel.formatted_address || hotel.address || '';
  const reviews = hotel.reviews || [];
  const userRatingsTotal = hotel.user_ratings_total || 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Bed className="w-5 h-5 text-[#D97706] dark:text-amber-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
              {name}
            </h2>
            {rating > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded text-sm">
                <StarIcon className="w-3 h-3 fill-current" />
                {rating.toFixed(1)}
              </span>
            )}
          </div>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            aria-label={t('hotels.closeModal')}
          >
            <XIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Loading state */}
          {isLoadingDetails && (
            <div className="flex items-center justify-center py-12">
              <Spinner className="w-6 h-6" />
              <span className="ml-2 text-gray-500 dark:text-gray-400">{t('hotels.loadingDetails')}</span>
            </div>
          )}

          {/* Error state */}
          {detailsError && (
            <div className="m-4 flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
              <InfoCircleIcon className="w-5 h-5 flex-shrink-0" />
              <span>{detailsError}</span>
            </div>
          )}

          {/* Photo Gallery */}
          {photos.length > 0 && (
            <div className="relative h-64 bg-gray-100 dark:bg-gray-900">
              <img
                src={photos[currentImageIndex]?.url}
                alt={`${name} - Photo ${currentImageIndex + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.src = 'https://placehold.co/800x400/e2e8f0/94a3b8?text=No+Image';
                }}
              />
              {photos.length > 1 && (
                <>
                  <button
                    onClick={() => setCurrentImageIndex(i => (i - 1 + photos.length) % photos.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                    aria-label={t('hotels.previousImage')}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setCurrentImageIndex(i => (i + 1) % photos.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                    aria-label={t('hotels.nextImage')}
                  >
                    <RightChevron className="w-5 h-5" />
                  </button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                    {currentImageIndex + 1} / {photos.length}
                  </div>
                </>
              )}
            </div>
          )}

          {/* No photo placeholder */}
          {photos.length === 0 && !isLoadingDetails && (
            <div className="h-48 bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
              <span className="text-gray-400 dark:text-gray-600 text-sm">{t('hotels.noPhotos')}</span>
            </div>
          )}

          <div className="p-4 space-y-4">
            {/* Address & Contact */}
            <div className="space-y-2">
              {address && (
                <p className="flex items-start gap-2 text-gray-600 dark:text-gray-400">
                  <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {address}
                </p>
              )}
              {hotel.phone_number && (
                <p className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <TelephoneIcon className="w-4 h-4" />
                  <a href={`tel:${hotel.phone_number}`} className="hover:underline">
                    {hotel.phone_number}
                  </a>
                </p>
              )}
              {hotel.website && (
                <p className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <GlobeIcon className="w-4 h-4" />
                  <a
                    href={hotel.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#D97706] dark:text-amber-400 hover:underline truncate"
                  >
                    {t('hotels.visitWebsite')}
                  </a>
                </p>
              )}
              {hotel.google_maps_url && (
                <p className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <Map className="w-4 h-4" />
                  <a
                    href={hotel.google_maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#D97706] dark:text-amber-400 hover:underline"
                  >
                    {t('hotels.viewOnGoogleMaps')}
                  </a>
                </p>
              )}
            </div>

            {/* Rating summary */}
            {rating > 0 && (
              <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <div className="text-2xl font-bold text-[#D97706] dark:text-amber-400">
                  {rating.toFixed(1)}
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map(star => (
                      <StarIcon
                        key={star}
                        className={`w-4 h-4 ${
                          star <= Math.round(rating)
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-300 dark:text-gray-600'
                        }`}
                      />
                    ))}
                  </div>
                  {userRatingsTotal > 0 && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                      {t('hotels.reviews', { count: userRatingsTotal })}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Reviews */}
            {reviews.length > 0 && (
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white mb-3">{t('hotels.guestReviews')}</h3>
                <div className="space-y-3">
                  {reviews.map((review, index) => (
                    <div
                      key={index}
                      className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm text-gray-900 dark:text-white">
                          {review.author_name || t('hotels.anonymous')}
                        </span>
                        <div className="flex items-center gap-1">
                          {review.rating && (
                            <>
                              <StarIcon className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                              <span className="text-sm text-gray-600 dark:text-gray-400">
                                {review.rating}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      {review.relative_time_description && (
                        <p className="text-xs text-gray-500 dark:text-gray-500 mb-1">
                          {review.relative_time_description}
                        </p>
                      )}
                      {review.text && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
                          {review.text}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSelectHotel}
              className="flex-1 px-4 py-2 bg-[#D97706] text-white rounded-lg hover:bg-[#B45309] transition-colors flex items-center justify-center gap-2"
            >
              <CheckedIcon className="w-4 h-4" />
              {t('hotels.selectHotel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HotelDetailModal;
