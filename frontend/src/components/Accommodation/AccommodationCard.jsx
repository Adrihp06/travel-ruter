import React from 'react';
import {
  Bed,
  Calendar,
  MapPin,
  ExternalLink,
  Hash,
  Star,
  Pencil,
  Trash2,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { formatDateWithWeekday } from '../../utils/dateFormat';

const accommodationTypeIcons = {
  hotel: '🏨',
  hostel: '🛏️',
  airbnb: '🏠',
  apartment: '🏢',
  resort: '🏝️',
  camping: '⛺',
  guesthouse: '🏡',
  ryokan: '🏯',
  other: '🏘️',
};

const AccommodationCard = ({
  accommodation,
  onEdit,
  onDelete,
  onShowOnMap,
  isCompact = false,
}) => {
  const {
    name,
    type,
    address,
    check_in_date,
    check_out_date,
    booking_reference,
    booking_url,
    total_cost,
    currency = 'USD',
    is_paid,
    amenities = [],
    rating,
    description,
  } = accommodation;

  // Calculate nights
  const calculateNights = () => {
    if (check_in_date && check_out_date) {
      const checkIn = new Date(check_in_date);
      const checkOut = new Date(check_out_date);
      const diff = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
      return diff > 0 ? diff : 0;
    }
    return 0;
  };

  const nights = calculateNights();
  const pricePerNight = nights > 0 && total_cost ? (total_cost / nights).toFixed(2) : null;
  const typeIcon = accommodationTypeIcons[type] || accommodationTypeIcons.other;

  if (isCompact) {
    return (
      <div className="bg-white dark:bg-gray-700 p-3 rounded-lg shadow-sm group hover:shadow-md transition-shadow border border-gray-100 dark:border-gray-600">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2 min-w-0">
            <span className="text-lg flex-shrink-0">{typeIcon}</span>
            <div className="min-w-0">
              <h4 className="font-medium text-gray-900 dark:text-white truncate">{name}</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{type}</p>
            </div>
          </div>
          <div className="opacity-0 group-hover:opacity-100 flex space-x-1 transition-opacity flex-shrink-0">
            {onEdit && (
              <button
                onClick={() => onEdit(accommodation)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                title="Edit accommodation"
              >
                <Pencil className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(accommodation.id)}
                className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                title="Delete accommodation"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
              </button>
            )}
          </div>
        </div>
        <div className="mt-2 flex items-center text-xs text-gray-500 dark:text-gray-400 space-x-3">
          <span className="flex items-center">
            <Calendar className="w-3 h-3 mr-1" />
            {nights} night{nights !== 1 ? 's' : ''}
          </span>
          {total_cost && (
            <span className="flex items-center">
              {total_cost} {currency}
            </span>
          )}
          {is_paid && (
            <span className="flex items-center text-green-600 dark:text-green-400">
              <CheckCircle className="w-3 h-3 mr-1" />
              Paid
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center text-xl">
              {typeIcon}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">{name}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 capitalize flex items-center">
                {type}
                {rating && (
                  <span className="ml-2 flex items-center text-amber-500">
                    <Star className="w-3.5 h-3.5 mr-0.5 fill-current" />
                    {rating}
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex space-x-1">
            {onShowOnMap && address && (
              <button
                onClick={() => onShowOnMap(accommodation)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Show on map"
              >
                <MapPin className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </button>
            )}
            {onEdit && (
              <button
                onClick={() => onEdit(accommodation)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Edit"
              >
                <Pencil className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(accommodation.id)}
                className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                title="Delete"
              >
                <Trash2 className="w-4 h-4 text-red-500 dark:text-red-400" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {/* Dates */}
        <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Check-in</p>
            <p className="font-medium text-gray-900 dark:text-white">{formatDateWithWeekday(check_in_date)}</p>
          </div>
          <div className="flex flex-col items-center px-4">
            <div className="flex items-center text-indigo-600 dark:text-indigo-400">
              <Clock className="w-4 h-4 mr-1" />
              <span className="font-semibold">{nights}</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">night{nights !== 1 ? 's' : ''}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Check-out</p>
            <p className="font-medium text-gray-900 dark:text-white">{formatDateWithWeekday(check_out_date)}</p>
          </div>
        </div>

        {/* Address */}
        {address && (
          <div className="flex items-start space-x-2 text-sm">
            <MapPin className="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
            <p className="text-gray-600 dark:text-gray-300">{address}</p>
          </div>
        )}

        {/* Booking Info */}
        {(booking_reference || booking_url) && (
          <div className="flex items-center space-x-4 text-sm">
            {booking_reference && (
              <div className="flex items-center text-gray-600 dark:text-gray-300">
                <Hash className="w-4 h-4 text-gray-400 dark:text-gray-500 mr-1" />
                <span className="font-mono">{booking_reference}</span>
              </div>
            )}
            {booking_url && (
              <a
                href={booking_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                View Booking
              </a>
            )}
          </div>
        )}

        {/* Amenities */}
        {amenities && amenities.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {amenities.map((amenity) => (
              <span
                key={amenity}
                className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full"
              >
                {amenity}
              </span>
            ))}
          </div>
        )}

        {/* Notes */}
        {description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">{description}</p>
        )}
      </div>

      {/* Footer - Price */}
      {total_cost && (
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {total_cost} {currency}
            </p>
            {pricePerNight && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {pricePerNight} {currency} / night
              </p>
            )}
          </div>
          {is_paid ? (
            <span className="flex items-center px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm rounded-full">
              <CheckCircle className="w-4 h-4 mr-1" />
              Paid
            </span>
          ) : (
            <span className="px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-sm rounded-full">
              Unpaid
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default AccommodationCard;
