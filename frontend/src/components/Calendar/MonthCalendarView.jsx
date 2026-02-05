import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, MapPin, Plane, Home, Car, Train, Bus, Footprints, Bike, Ship } from 'lucide-react';
import { formatDateShort } from '../../utils/dateFormat';
import { getTransportIcon } from './CalendarView';

const MonthCalendarView = ({
  trip,
  tripDateRange,
  selectedDate,
  onDateChange,
  poisByDate,
  accommodationsByDate,
  destinationsByDate,
  travelSegments = [],
}) => {
  const [currentMonth, setCurrentMonth] = useState(() => {
    return selectedDate ? new Date(selectedDate) : new Date();
  });

  // Generate calendar days for the current month
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    // First day of the month
    const firstDay = new Date(year, month, 1);
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0);

    // Start from the first day of the week containing the first day of the month
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay()); // Go back to Sunday

    // End on the last day of the week containing the last day of the month
    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - lastDay.getDay())); // Go forward to Saturday

    const days = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      days.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return days;
  }, [currentMonth]);

  // Check if a date is within the trip range
  const isDateInTrip = (date) => {
    if (!tripDateRange) return false;
    return date >= tripDateRange.startDate && date <= tripDateRange.endDate;
  };

  // Check if a date is in the current month
  const isCurrentMonth = (date) => {
    return date.getMonth() === currentMonth.getMonth();
  };

  // Check if a date is today
  const isToday = (date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // Get data for a specific date
  const getDateData = (date) => {
    // Use local date components to match YYYY-MM-DD format stored in backend
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return {
      pois: poisByDate[dateKey] || [],
      accommodations: accommodationsByDate[dateKey] || [],
      destinations: destinationsByDate[dateKey] || [],
    };
  };

  const handlePreviousMonth = () => {
    setCurrentMonth(prevMonth => {
      const newMonth = new Date(prevMonth);
      newMonth.setMonth(newMonth.getMonth() - 1);
      return newMonth;
    });
  };

  const handleNextMonth = () => {
    setCurrentMonth(prevMonth => {
      const newMonth = new Date(prevMonth);
      newMonth.setMonth(newMonth.getMonth() + 1);
      return newMonth;
    });
  };

  const handleDateClick = (date) => {
    onDateChange(date);
  };

  const monthYearText = currentMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="flex flex-col h-full p-4 overflow-auto">
      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {monthYearText}
        </h3>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePreviousMonth}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>

          <button
            onClick={() => setCurrentMonth(new Date())}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Today
          </button>

          <button
            onClick={handleNextMonth}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1">
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div
              key={day}
              className="text-center text-sm font-semibold text-gray-600 dark:text-gray-400 py-2"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7 gap-2">
          {calendarDays.map((date, index) => {
            const dateData = getDateData(date);
            const inTrip = isDateInTrip(date);
            const inCurrentMonth = isCurrentMonth(date);
            const today = isToday(date);
            const isSelected = selectedDate &&
              date.getDate() === selectedDate.getDate() &&
              date.getMonth() === selectedDate.getMonth() &&
              date.getFullYear() === selectedDate.getFullYear();

            const hasAccommodation = dateData.accommodations.length > 0;
            const hasPOIs = dateData.pois.length > 0;
            const hasDestinationEvent = dateData.destinations.length > 0;

            return (
              <button
                key={index}
                onClick={() => handleDateClick(date)}
                className={`
                  relative min-h-24 p-2 rounded-lg border transition-all
                  ${inCurrentMonth ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900'}
                  ${inTrip ? 'border-blue-200 dark:border-blue-800' : 'border-gray-200 dark:border-gray-700'}
                  ${isSelected ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''}
                  ${today ? 'border-blue-500 dark:border-blue-400 border-2' : ''}
                  ${hasAccommodation ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}
                  hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600
                  ${inCurrentMonth ? '' : 'opacity-50'}
                `}
              >
                {/* Date Number */}
                <div className={`
                  text-sm font-medium mb-1
                  ${today ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-900 dark:text-gray-100'}
                  ${!inCurrentMonth ? 'text-gray-400 dark:text-gray-600' : ''}
                `}>
                  {date.getDate()}
                </div>

                {/* Destination Markers */}
                {hasDestinationEvent && (
                  <div className="flex flex-col gap-1 mb-1">
                    {dateData.destinations.map((dest, idx) => {
                      const TransportIcon = getTransportIcon(travelSegments, dest.id, dest.isArrival);
                      return (
                        <div
                          key={idx}
                          className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-1.5 py-0.5 rounded truncate"
                          title={`${dest.isArrival ? 'Arrive' : 'Depart'}: ${dest.city_name}`}
                        >
                          <TransportIcon className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate text-[10px]">{dest.city_name}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Accommodation Indicator */}
                {hasAccommodation && (
                  <div className="flex items-center gap-1 text-xs text-blue-700 dark:text-blue-400 mb-1">
                    <Home className="w-3 h-3" />
                  </div>
                )}

                {/* POI Count Badge */}
                {hasPOIs && (
                  <div className="flex items-center gap-1 text-xs">
                    <div className="flex items-center gap-1 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400 px-1.5 py-0.5 rounded">
                      <MapPin className="w-3 h-3" />
                      <span className="font-medium">{dateData.pois.length}</span>
                    </div>
                  </div>
                )}

                {/* Trip Highlight Border */}
                {inTrip && (
                  <div className="absolute inset-0 border-2 border-blue-400/20 dark:border-blue-600/20 rounded-lg pointer-events-none" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-blue-500 dark:border-blue-400 rounded" />
            <span>Today</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded" />
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
            <MapPin className="w-4 h-4 text-purple-700 dark:text-purple-400" />
            <span>POIs Scheduled</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonthCalendarView;
