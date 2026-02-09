import React from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin } from 'lucide-react';
import StarIcon from '@/components/icons/star-icon';
import ExternalLinkIcon from '@/components/icons/external-link-icon';

const HotelCard = ({ hotel, onClick, isSelected = false }) => {
  const { t } = useTranslation();
  const name = hotel.name || t('hotels.unknownHotel');
  const rating = hotel.rating || 0;
  const address = hotel.address || '';
  const userRatingsTotal = hotel.user_ratings_total || 0;

  // Get photo from Google Places format
  const mainPhoto = hotel.photos?.[0]?.url || 'https://placehold.co/400x300/e2e8f0/94a3b8?text=No+Image';

  // Rating label
  const getRatingLabel = (r) => {
    if (r >= 4.5) return t('hotels.ratingExceptional');
    if (r >= 4.0) return t('hotels.ratingExcellent');
    if (r >= 3.5) return t('hotels.ratingVeryGood');
    if (r >= 3.0) return t('hotels.ratingGood');
    return t('hotels.rating');
  };

  return (
    <div
      onClick={onClick}
      className={`
        bg-white dark:bg-gray-800 rounded-xl overflow-hidden
        border transition-all duration-200 cursor-pointer
        hover:shadow-lg hover:-translate-y-0.5
        ${isSelected
          ? 'border-[#D97706] dark:border-amber-400 ring-2 ring-amber-500/20'
          : 'border-gray-200 dark:border-gray-700'
        }
      `}
    >
      <div className="flex flex-col sm:flex-row">
        {/* Image */}
        <div className="relative w-full sm:w-48 h-40 sm:h-auto flex-shrink-0">
          <img
            src={mainPhoto}
            alt={name}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.src = 'https://placehold.co/400x300/e2e8f0/94a3b8?text=No+Image';
            }}
          />
          {/* Rating badge */}
          {rating > 0 && (
            <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1">
              <StarIcon className="w-3 h-3 fill-yellow-400 text-yellow-400" />
              {rating.toFixed(1)}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 p-4 flex flex-col">
          {/* Header */}
          <div className="flex justify-between items-start mb-2">
            <div className="flex-1 min-w-0 pr-2">
              <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                {name}
              </h3>
              {address && (
                <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{address}</span>
                </p>
              )}
            </div>
          </div>

          {/* Rating & Reviews */}
          {rating > 0 && (
            <div className="mt-auto pt-3 flex items-center gap-2">
              <span
                className={`
                  px-2 py-0.5 rounded text-sm font-medium
                  ${rating >= 4.0
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    : rating >= 3.0
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400'
                  }
                `}
              >
                {rating.toFixed(1)}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {getRatingLabel(rating)}
                {userRatingsTotal > 0 && ` · ${t('hotels.reviews', { count: userRatingsTotal })}`}
              </span>
            </div>
          )}

          {/* View Details link */}
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            <span className="text-sm text-[#D97706] dark:text-amber-400 font-medium inline-flex items-center gap-1 hover:underline">
              {t('hotels.viewDetails')}
              <ExternalLinkIcon className="w-3 h-3" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HotelCard;
