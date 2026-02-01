import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
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
  Plane,
  Archive
} from 'lucide-react';
import { formatDateFull } from '../../utils/dateFormat';

// Tag color mapping - Warm Explorer theme colors
const TAG_COLORS = {
  business: 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300',
  vacation: 'bg-lime-100 text-lime-700 dark:bg-lime-900/50 dark:text-lime-300',
  adventure: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
  romantic: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
  family: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  solo: 'bg-stone-100 text-stone-600 dark:bg-stone-700 dark:text-stone-300',
  cultural: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300',
  beach: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300',
};

// Status badge styling - moved outside component to avoid recreation on each render
const getStatusStyle = (status) => {
  switch (status) {
    case 'booked':
      return 'bg-lime-100 text-lime-700 border-lime-200 dark:bg-lime-900/30 dark:text-lime-300 dark:border-lime-700';
    case 'completed':
      return 'bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-600';
    case 'cancelled':
      return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700';
    default: // planning
      return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700';
  }
};

// Countdown badge styling - moved outside component to avoid recreation on each render
const getCountdownStyle = (type) => {
  switch (type) {
    case 'today':
    case 'tomorrow':
      return 'bg-red-500 text-white shadow-sm';
    case 'soon':
      return 'bg-orange-500 text-white shadow-sm';
    case 'ongoing':
      return 'bg-lime-600 text-white shadow-sm';
    case 'past':
      return 'bg-stone-400 text-white';
    default:
      return 'bg-amber-600 text-white shadow-sm';
  }
};

const TripCard = React.memo(function TripCard({
  trip,
  onEdit,
  onDelete,
  onDuplicate,
  onStatusChange,
  onShare,
  onExport,
  destinationCount = 0,
  totalPOIs = 0,
  scheduledPOIs = 0,
  budget = null
}) {
  const [showActions, setShowActions] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  const isCompleted = trip.status === 'completed';

  // Memoized event handlers to prevent unnecessary re-renders
  const handleToggleActions = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setShowActions(prev => !prev);
  }, []);

  const handleEdit = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    onEdit?.(trip);
    setShowActions(false);
  }, [onEdit, trip]);

  const handleDuplicate = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    onDuplicate?.(trip);
    setShowActions(false);
  }, [onDuplicate, trip]);

  const handleStatusChange = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    onStatusChange?.(trip, isCompleted ? 'planning' : 'completed');
    setShowActions(false);
  }, [onStatusChange, trip, isCompleted]);

  const handleShare = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    onShare?.(trip);
    setShowActions(false);
  }, [onShare, trip]);

  const handleExport = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    onExport?.(trip);
    setShowActions(false);
  }, [onExport, trip]);

  const handleDelete = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete?.(trip.id);
    setShowActions(false);
  }, [onDelete, trip.id]);

  // Close menu when clicking outside - always cleanup on unmount
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        showActions &&
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

  // POI scheduling progress percentage
  const progressPercent = totalPOIs > 0
    ? Math.round((scheduledPOIs / totalPOIs) * 100)
    : 0;

  // Memoize currency formatter to avoid creating new Intl.NumberFormat on every render
  const formatCurrency = useMemo(() => {
    const currency = trip.currency || 'USD';
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
    return (amount) => {
      if (amount == null) return null;
      return formatter.format(amount);
    };
  }, [trip.currency]);

  // Memoize default cover image based on location keywords
  const coverImage = useMemo(() => {
    if (trip.cover_image) return trip.cover_image;

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
  }, [trip.cover_image, trip.location]);

  return (
    <div className="trip-card group bg-white dark:bg-stone-800 rounded-2xl shadow-sm border border-stone-200/80 dark:border-stone-700 hover:shadow-xl hover:shadow-amber-900/5 dark:hover:shadow-2xl dark:hover:shadow-black/30 transition-all duration-300 hover:-translate-y-1 relative">
      {/* Quick actions menu - positioned outside overflow-hidden */}
      <div className="absolute top-3 right-3 z-30">
        <div className="relative">
          <button
            ref={buttonRef}
            onClick={handleToggleActions}
            className="p-2 bg-white/90 dark:bg-gray-700/90 hover:bg-white dark:hover:bg-gray-600 rounded-lg transition-colors shadow-sm"
          >
            <MoreVertical className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </button>

          {showActions && (
            <div
              ref={menuRef}
              className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-700 rounded-lg shadow-2xl border border-gray-300 dark:border-gray-600 py-1 z-50"
            >
                <button
                  onClick={handleEdit}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  <div className="flex items-center">
                    <Pencil className="w-4 h-4 mr-2" /> Edit
                  </div>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">⌘E</span>
                </button>
                <button
                  onClick={handleDuplicate}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  <div className="flex items-center">
                    <Copy className="w-4 h-4 mr-2" /> Duplicate
                  </div>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">⌘D</span>
                </button>
                
                <hr className="my-1 border-gray-100 dark:border-gray-600" />
                
                <button
                  onClick={handleStatusChange}
                  className="w-full flex items-center px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  {isCompleted ? (
                    <><Clock className="w-4 h-4 mr-2" /> Re-open Trip</>
                  ) : (
                    <><Archive className="w-4 h-4 mr-2" /> Complete Trip</>
                  )}
                </button>

                <hr className="my-1 border-gray-100 dark:border-gray-600" />

                <button
                  onClick={handleShare}
                  className="w-full flex items-center px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  <Share2 className="w-4 h-4 mr-2" /> Share Link
                </button>
                <button
                  onClick={handleExport}
                  className="w-full flex items-center px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  <Download className="w-4 h-4 mr-2" /> Export Data
                </button>
                
                <hr className="my-1 border-gray-100 dark:border-gray-600" />
                
                <button
                  onClick={handleDelete}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
                >
                  <div className="flex items-center">
                    <Trash2 className="w-4 h-4 mr-2" /> Delete
                  </div>
                  <span className="text-[10px] text-red-400 dark:text-red-500/70 font-medium">⌫</span>
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
          /* Warm Explorer gradient - amber to terracotta to olive */
          <div className="w-full h-full bg-gradient-to-br from-amber-500 via-orange-500 to-lime-600 transition-all duration-500 group-hover:from-amber-600 group-hover:via-orange-600 group-hover:to-lime-700">
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
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors line-clamp-1">
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
                {formatCurrency(trip.total_budget || budget?.total_budget)}
              </div>
              {budget?.actual_total != null && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {formatCurrency(budget.actual_total)} spent
                </div>
              )}
            </div>
          </div>
        )}

        {/* Progress indicator - shows POI scheduling progress */}
        {totalPOIs > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-gray-600 dark:text-gray-300">POIs Scheduled</span>
              <span className="text-gray-900 dark:text-white font-medium">{scheduledPOIs}/{totalPOIs}</span>
            </div>
            <div className="h-2 bg-stone-100 dark:bg-stone-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
        {/* Destination count - show when there are destinations but no POIs yet */}
        {destinationCount > 0 && totalPOIs === 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-300">Destinations</span>
              <span className="text-gray-900 dark:text-white font-medium">{destinationCount}</span>
            </div>
          </div>
        )}

        {/* View itinerary link - Warm Explorer theme */}
        <Link
          to={`/trips/${trip.id}`}
          className="inline-flex items-center w-full justify-center px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 font-semibold rounded-xl hover:bg-amber-100 dark:hover:bg-amber-900/40 btn-interactive btn-ripple group/link border border-amber-200/50 dark:border-amber-700/30"
        >
          View Itinerary
          <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover/link:translate-x-1.5" />
        </Link>
      </div>
    </div>
  );
});

export default TripCard;
