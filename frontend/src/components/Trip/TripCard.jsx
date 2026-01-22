import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  MapPin,
  ArrowRight,
  Pencil,
  Trash2,
  Copy,
  Share2,
  Download,
  Calendar,
  DollarSign,
  Clock,
  MoreVertical,
  CheckCircle2,
  Circle,
  Plane,
  Tag
} from 'lucide-react';
import { formatDateFull } from '../../utils/dateFormat';

// Tag color mapping (matches TripFormModal)
const TAG_COLORS = {
  business: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  vacation: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
  adventure: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
  romantic: 'bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300',
  family: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
  solo: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  cultural: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  beach: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300',
};

const TripCard = ({
  trip,
  onEdit,
  onDelete,
  onDuplicate,
  onShare,
  onExport,
  destinationCount = 0,
  completedDestinations = 0,
  budget = null
}) => {
  const [showActions, setShowActions] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (!showActions) return;

    const handleClickOutside = (event) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setShowActions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showActions]);

  // Get trip title (handles both API format and mock data)
  const title = trip.title || trip.name || 'Untitled Trip';

  // Get trip description
  const description = useMemo(() => {
    if (trip.description) return trip.description;
    if (trip.location) return `Exploring ${trip.location} and surrounding areas.`;
    return 'Plan your adventure!';
  }, [trip.description, trip.location]);


  // Calculate countdown
  const countdown = useMemo(() => {
    if (!trip.start_date) return null;
    const startDate = new Date(trip.start_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    startDate.setHours(0, 0, 0, 0);

    const diffTime = startDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      // Trip is in the past or ongoing
      const endDate = trip.end_date ? new Date(trip.end_date) : null;
      if (endDate) {
        endDate.setHours(0, 0, 0, 0);
        if (today <= endDate) {
          return { type: 'ongoing', text: 'Trip in progress' };
        }
      }
      return { type: 'past', text: 'Completed' };
    } else if (diffDays === 0) {
      return { type: 'today', text: 'Departing today!' };
    } else if (diffDays === 1) {
      return { type: 'tomorrow', text: 'Departing tomorrow!' };
    } else if (diffDays <= 7) {
      return { type: 'soon', text: `${diffDays} days to go` };
    } else if (diffDays <= 30) {
      return { type: 'upcoming', text: `${diffDays} days until departure` };
    } else {
      const weeks = Math.floor(diffDays / 7);
      return { type: 'future', text: `${weeks} weeks away` };
    }
  }, [trip.start_date, trip.end_date]);

  // Destination progress percentage
  const progressPercent = destinationCount > 0
    ? Math.round((completedDestinations / destinationCount) * 100)
    : 0;

  // Status badge styling
  const getStatusStyle = (status) => {
    switch (status) {
      case 'booked':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'completed':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'cancelled':
        return 'bg-red-100 text-red-700 border-red-200';
      default: // planning
        return 'bg-amber-100 text-amber-700 border-amber-200';
    }
  };

  // Countdown badge styling
  const getCountdownStyle = (type) => {
    switch (type) {
      case 'today':
      case 'tomorrow':
        return 'bg-red-500 text-white';
      case 'soon':
        return 'bg-orange-500 text-white';
      case 'ongoing':
        return 'bg-green-500 text-white';
      case 'past':
        return 'bg-gray-400 text-white';
      default:
        return 'bg-indigo-500 text-white';
    }
  };

  // Format currency
  const formatCurrency = (amount, currency = 'USD') => {
    if (amount == null) return null;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Default cover images based on location keywords
  const getDefaultCoverImage = () => {
    const location = (trip.location || '').toLowerCase();
    if (location.includes('beach') || location.includes('hawaii') || location.includes('caribbean')) {
      return 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=200&fit=crop';
    }
    if (location.includes('mountain') || location.includes('alps') || location.includes('swiss')) {
      return 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&h=200&fit=crop';
    }
    if (location.includes('japan') || location.includes('tokyo') || location.includes('kyoto')) {
      return 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400&h=200&fit=crop';
    }
    if (location.includes('paris') || location.includes('france')) {
      return 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=400&h=200&fit=crop';
    }
    if (location.includes('norway') || location.includes('fjord') || location.includes('nordic')) {
      return 'https://images.unsplash.com/photo-1520769669658-f07657f5a307?w=400&h=200&fit=crop';
    }
    return null; // Will show gradient instead
  };

  const coverImage = trip.cover_image || getDefaultCoverImage();

  return (
    <div className="trip-card group bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-xl dark:hover:shadow-2xl dark:hover:shadow-black/30 transition-all duration-300 hover:-translate-y-1 relative">
      {/* Quick actions menu - positioned outside overflow-hidden */}
      <div className="absolute top-3 right-3 z-30">
        <div className="relative">
          <button
            ref={buttonRef}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowActions(!showActions);
            }}
            className="p-2 bg-white/90 dark:bg-gray-700/90 hover:bg-white dark:hover:bg-gray-600 rounded-lg transition-colors shadow-sm"
          >
            <MoreVertical className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </button>

          {showActions && (
            <div
              ref={menuRef}
              className="absolute right-0 mt-1 w-40 bg-white dark:bg-gray-700 rounded-lg shadow-2xl border border-gray-300 dark:border-gray-600 py-1 z-50"
            >
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onEdit?.(trip);
                    setShowActions(false);
                  }}
                  className="w-full flex items-center px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  <Pencil className="w-4 h-4 mr-2" /> Edit
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDuplicate?.(trip);
                    setShowActions(false);
                  }}
                  className="w-full flex items-center px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  <Copy className="w-4 h-4 mr-2" /> Duplicate
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onShare?.(trip);
                    setShowActions(false);
                  }}
                  className="w-full flex items-center px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  <Share2 className="w-4 h-4 mr-2" /> Share
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onExport?.(trip);
                    setShowActions(false);
                  }}
                  className="w-full flex items-center px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  <Download className="w-4 h-4 mr-2" /> Export
                </button>
                <hr className="my-1 border-gray-100 dark:border-gray-600" />
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDelete?.(trip.id);
                    setShowActions(false);
                  }}
                  className="w-full flex items-center px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Delete
                </button>
              </div>
          )}
        </div>
      </div>

      {/* Cover Image Section */}
      <div className="relative h-40 overflow-hidden rounded-t-2xl">
        {coverImage ? (
          <img
            src={coverImage}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 transition-all duration-500 group-hover:from-indigo-600 group-hover:via-purple-600 group-hover:to-pink-600">
            <div className="absolute inset-0 flex items-center justify-center">
              <Plane className="w-16 h-16 text-white/30" />
            </div>
          </div>
        )}

        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

        {/* Status badge */}
        <div className="absolute top-3 left-3">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${getStatusStyle(trip.status)}`}>
            {trip.status ? trip.status.charAt(0).toUpperCase() + trip.status.slice(1) : 'Planning'}
          </span>
        </div>

        {/* Countdown badge */}
        {countdown && countdown.type !== 'past' && (
          <div className={`absolute bottom-3 left-3 flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getCountdownStyle(countdown.type)}`}>
            <Clock className="w-3.5 h-3.5" />
            <span>{countdown.text}</span>
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="p-5">
        {/* Title and location */}
        <div className="mb-3">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
            {title}
          </h3>
          {trip.location && (
            <div className="flex items-center text-gray-500 dark:text-gray-400 text-sm">
              <MapPin className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
              <span className="line-clamp-1">{trip.location}</span>
            </div>
          )}
          {/* Tags */}
          {trip.tags && trip.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {trip.tags.slice(0, 3).map((tagId) => (
                <span
                  key={tagId}
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    TAG_COLORS[tagId] || 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                  }`}
                >
                  {tagId.charAt(0).toUpperCase() + tagId.slice(1)}
                </span>
              ))}
              {trip.tags.length > 3 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                  +{trip.tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Description */}
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-4 leading-relaxed line-clamp-2">
          {description}
        </p>

        {/* Dates */}
        <div className="flex items-center text-sm text-gray-600 dark:text-gray-300 mb-4">
          <Calendar className="w-4 h-4 mr-1.5 text-gray-400 dark:text-gray-500" />
          <span>
            {formatDateFull(trip.start_date)}
            {trip.end_date && ` - ${formatDateFull(trip.end_date)}`}
          </span>
        </div>

        {/* Budget display */}
        {(trip.total_budget || budget) && (
          <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="flex items-center text-sm">
              <DollarSign className="w-4 h-4 mr-1.5 text-gray-400 dark:text-gray-500" />
              <span className="text-gray-600 dark:text-gray-300">Budget</span>
            </div>
            <div className="text-right">
              <div className="font-semibold text-gray-900 dark:text-white">
                {formatCurrency(trip.total_budget || budget?.total_budget, trip.currency)}
              </div>
              {budget?.actual_total != null && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {formatCurrency(budget.actual_total, trip.currency)} spent
                </div>
              )}
            </div>
          </div>
        )}

        {/* Progress indicator */}
        {destinationCount > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-gray-600 dark:text-gray-300">Destinations</span>
              <span className="text-gray-900 dark:text-white font-medium">{completedDestinations}/{destinationCount}</span>
            </div>
            <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* View itinerary link */}
        <Link
          to={`/trips/${trip.id}`}
          className="inline-flex items-center w-full justify-center px-4 py-2.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-semibold rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors group/link"
        >
          View Itinerary
          <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover/link:translate-x-1" />
        </Link>
      </div>
    </div>
  );
};

export default TripCard;
