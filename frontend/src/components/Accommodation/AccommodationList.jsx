import React from 'react';
import { useTranslation } from 'react-i18next';
import { Bed, Plus } from 'lucide-react';
import InfoCircleIcon from '@/components/icons/info-circle-icon';
import AccommodationCard from './AccommodationCard';

const AccommodationList = ({
  accommodations = [],
  onAdd,
  onEdit,
  onDelete,
  onShowOnMap,
  isLoading = false,
  error = null,
  emptyMessage,
  title,
  showAddButton = true,
  isCompact = false,
}) => {
  const { t } = useTranslation();

  const displayTitle = title || t('accommodation.title');
  const displayEmptyMessage = emptyMessage || t('accommodation.noAccommodations');

  // Calculate total cost
  const totalCost = accommodations.reduce((sum, acc) => {
    return sum + (acc.total_cost || 0);
  }, 0);

  // Calculate total nights
  const totalNights = accommodations.reduce((sum, acc) => {
    if (acc.check_in_date && acc.check_out_date) {
      const checkIn = new Date(acc.check_in_date);
      const checkOut = new Date(acc.check_out_date);
      const diff = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
      return sum + (diff > 0 ? diff : 0);
    }
    return sum;
  }, 0);

  // Get primary currency (most common)
  const currencies = accommodations.map((a) => a.currency || 'USD');
  const primaryCurrency = currencies.length > 0
    ? currencies.sort((a, b) =>
        currencies.filter((c) => c === a).length - currencies.filter((c) => c === b).length
      ).pop()
    : 'USD';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Bed className="w-5 h-5 text-[#D97706] dark:text-amber-400" />
          <h3 className="font-semibold text-gray-900 dark:text-white">{displayTitle}</h3>
          {accommodations.length > 0 && (
            <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full">
              {accommodations.length}
            </span>
          )}
        </div>
        {showAddButton && onAdd && (
          <button
            onClick={onAdd}
            className="flex items-center space-x-1 px-3 py-1.5 text-sm text-[#D97706] dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{t('common.add')}</span>
          </button>
        )}
      </div>

      {/* Summary Stats */}
      {accommodations.length > 0 && !isCompact && (
        <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
          <div>
            <span className="font-medium text-gray-900 dark:text-white">{totalNights}</span>
            <span className="ml-1">{t('common.nightCount', { count: totalNights })}</span>
          </div>
          <div className="w-px h-4 bg-gray-300 dark:bg-gray-600" />
          <div>
            <span className="font-medium text-gray-900 dark:text-white">{totalCost.toFixed(0)}</span>
            <span className="ml-1">{primaryCurrency} {t('common.total')}</span>
          </div>
          <div className="w-px h-4 bg-gray-300 dark:bg-gray-600" />
          <div>
            <span className="font-medium text-gray-900 dark:text-white">
              {totalNights > 0 ? (totalCost / totalNights).toFixed(0) : 0}
            </span>
            <span className="ml-1">{t('accommodation.nightAvg', { currency: primaryCurrency })}</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="flex items-center space-x-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
          <InfoCircleIcon className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#D97706] dark:border-amber-400" />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && accommodations.length === 0 && (
        <div className="text-center py-8 bg-gray-50 dark:bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700">
          <Bed className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">{displayEmptyMessage}</p>
          {showAddButton && onAdd && (
            <button
              onClick={onAdd}
              className="mt-3 inline-flex items-center space-x-1 px-4 py-2 text-sm bg-[#D97706] hover:bg-[#B45309] text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>{t('accommodation.add')}</span>
            </button>
          )}
        </div>
      )}

      {/* Accommodation Cards */}
      {!isLoading && accommodations.length > 0 && (
        <div className={isCompact ? 'space-y-2' : 'space-y-4'}>
          {accommodations.map((accommodation) => (
            <AccommodationCard
              key={accommodation.id}
              accommodation={accommodation}
              onEdit={onEdit}
              onDelete={onDelete}
              onShowOnMap={onShowOnMap}
              isCompact={isCompact}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default AccommodationList;
