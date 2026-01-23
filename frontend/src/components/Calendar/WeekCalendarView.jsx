import React, { useState, useMemo, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Clock,
  Plane,
  Home,
  GripVertical,
  Landmark,
  UtensilsCrossed,
  Mountain,
  TreePine,
  ShoppingBag,
  Music,
  Camera,
} from 'lucide-react';
import { formatDateWithWeekday } from '../../utils/dateFormat';
import usePOIStore from '../../stores/usePOIStore';

// Category icon mapping (same as DailyItinerary)
const categoryIcons = {
  'Sights': Landmark,
  'Museums': Landmark,
  'Food': UtensilsCrossed,
  'Restaurants': UtensilsCrossed,
  'Viewpoints': Mountain,
  'Nature': TreePine,
  'Shopping': ShoppingBag,
  'Entertainment': Music,
  'Photography': Camera,
  'Accommodation': MapPin,
  'Activity': MapPin,
  'Museum': Landmark,
};

// Category color mapping (same as DailyItinerary)
const categoryColors = {
  'Sights': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  'Museums': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  'Food': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  'Restaurants': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  'Viewpoints': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  'Nature': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  'Shopping': 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  'Entertainment': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  'Photography': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  'Accommodation': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  'Activity': 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  'Museum': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
};

// Format minutes to hours and minutes
const formatDwellTime = (minutes) => {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

// POI Card Component (draggable)
const POICard = ({ poi, isDragging }) => {
  const Icon = categoryIcons[poi.category] || MapPin;
  const colorClass = categoryColors[poi.category] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';

  return (
    <div
      className={`
        group relative p-2 rounded-lg border transition-all
        ${isDragging ? 'opacity-50' : 'opacity-100'}
        bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700
        hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600
        cursor-grab active:cursor-grabbing
      `}
    >
      <div className="flex items-start gap-2">
        {/* Drag Handle */}
        <GripVertical className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />

        {/* Category Icon */}
        <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${colorClass} flex-shrink-0`}>
          <Icon className="w-4 h-4" />
        </div>

        {/* POI Info */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {poi.name}
          </h4>

          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
            {poi.dwell_time && (
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{formatDwellTime(poi.dwell_time)}</span>
              </div>
            )}
            {poi.estimated_cost && (
              <span className="text-gray-400 dark:text-gray-500">
                ${poi.estimated_cost}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Droppable Day Column
const DayColumn = ({ date, dateKey, pois, accommodations, destinations, isInTrip }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: dateKey,
    data: {
      type: 'day-column',
      date: dateKey,
    },
  });

  const hasAccommodation = accommodations.length > 0;
  const hasDestinations = destinations.length > 0;

  return (
    <div
      ref={setNodeRef}
      className={`
        flex flex-col min-h-[400px] rounded-lg border transition-all
        ${isInTrip ? 'bg-blue-50/30 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}
        ${hasAccommodation ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}
        ${isOver ? 'ring-2 ring-blue-500 dark:ring-blue-400 bg-blue-50 dark:bg-blue-900/30' : ''}
      `}
    >
      {/* Day Header */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
          {formatDateWithWeekday(dateKey)}
        </div>

        {/* Destination Events */}
        {hasDestinations && (
          <div className="flex flex-col gap-1 mt-2">
            {destinations.map((dest, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-2 py-1 rounded"
              >
                <Plane className="w-3 h-3" />
                <span className="truncate">
                  {dest.isArrival ? 'Arrive' : 'Depart'}: {dest.city_name}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Accommodation Indicator */}
        {hasAccommodation && (
          <div className="flex items-center gap-1 text-xs text-blue-700 dark:text-blue-400 mt-2">
            <Home className="w-3 h-3" />
            <span className="truncate">{accommodations[0].name}</span>
          </div>
        )}
      </div>

      {/* POI List */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto">
        {pois.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-sm text-gray-400 dark:text-gray-500">
            No POIs scheduled
          </div>
        ) : (
          pois.map((poi) => (
            <DraggablePOI key={poi.id} poi={poi} />
          ))
        )}
      </div>
    </div>
  );
};

// Draggable POI wrapper
const DraggablePOI = ({ poi }) => {
  const [isDragging, setIsDragging] = useState(false);

  return (
    <div
      draggable
      onDragStart={(e) => {
        setIsDragging(true);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('application/json', JSON.stringify({
          poiId: poi.id,
          sourceDate: poi.scheduled_date,
        }));
      }}
      onDragEnd={() => setIsDragging(false)}
    >
      <POICard poi={poi} isDragging={isDragging} />
    </div>
  );
};

const WeekCalendarView = ({
  trip,
  tripDateRange,
  selectedDate,
  onDateChange,
  poisByDate,
  accommodationsByDate,
  destinationsByDate,
  destinations,
  pois,
}) => {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const start = selectedDate ? new Date(selectedDate) : new Date();
    start.setDate(start.getDate() - start.getDay()); // Set to Sunday
    return start;
  });

  const { updatePOI } = usePOIStore();

  // Generate week days
  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(currentWeekStart);
      day.setDate(currentWeekStart.getDate() + i);
      days.push(day);
    }
    return days;
  }, [currentWeekStart]);

  // Check if a date is within the trip range
  const isDateInTrip = (date) => {
    if (!tripDateRange) return false;
    return date >= tripDateRange.startDate && date <= tripDateRange.endDate;
  };

  const handlePreviousWeek = () => {
    setCurrentWeekStart(prev => {
      const newStart = new Date(prev);
      newStart.setDate(newStart.getDate() - 7);
      return newStart;
    });
  };

  const handleNextWeek = () => {
    setCurrentWeekStart(prev => {
      const newStart = new Date(prev);
      newStart.setDate(newStart.getDate() + 7);
      return newStart;
    });
  };

  const handleToday = () => {
    const today = new Date();
    today.setDate(today.getDate() - today.getDay()); // Set to Sunday
    setCurrentWeekStart(today);
  };

  // Handle POI drop
  const handleDrop = useCallback(async (e, targetDateKey) => {
    e.preventDefault();

    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      const { poiId, sourceDate } = data;

      // Don't update if dropped on the same date
      if (sourceDate === targetDateKey) return;

      // Update POI scheduled_date
      await updatePOI(poiId, { scheduled_date: targetDateKey });
    } catch (error) {
      console.error('Failed to reschedule POI:', error);
    }
  }, [updatePOI]);

  const weekRange = useMemo(() => {
    const start = weekDays[0];
    const end = weekDays[6];
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }, [weekDays]);

  return (
    <div className="flex flex-col h-full p-4 overflow-auto">
      {/* Week Navigation */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {weekRange}
        </h3>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePreviousWeek}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Previous week"
          >
            <ChevronLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>

          <button
            onClick={handleToday}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Today
          </button>

          <button
            onClick={handleNextWeek}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Next week"
          >
            <ChevronRight className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
        </div>
      </div>

      {/* Week Grid */}
      <div className="grid grid-cols-7 gap-3 flex-1">
        {weekDays.map((date) => {
          const dateKey = date.toISOString().split('T')[0];
          const dayPOIs = poisByDate[dateKey] || [];
          const dayAccommodations = accommodationsByDate[dateKey] || [];
          const dayDestinations = destinationsByDate[dateKey] || [];
          const inTrip = isDateInTrip(date);

          return (
            <div
              key={dateKey}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, dateKey)}
            >
              <DayColumn
                date={date}
                dateKey={dateKey}
                pois={dayPOIs}
                accommodations={dayAccommodations}
                destinations={dayDestinations}
                isInTrip={inTrip}
              />
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded" />
            <span>Trip Dates</span>
          </div>
          <div className="flex items-center gap-2">
            <Home className="w-4 h-4 text-blue-700 dark:text-blue-400" />
            <span>Accommodation</span>
          </div>
          <div className="flex items-center gap-2">
            <Plane className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            <span>Destination Change</span>
          </div>
          <div className="flex items-center gap-2">
            <GripVertical className="w-4 h-4 text-gray-400" />
            <span>Drag to reschedule</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeekCalendarView;
