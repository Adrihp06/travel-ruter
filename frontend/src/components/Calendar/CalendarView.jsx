import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar as CalendarIcon, Grid3x3 } from 'lucide-react';
import UnorderedListIcon from '@/components/icons/unordered-list-icon';
import MonthCalendarView from './MonthCalendarView';
import WeekCalendarView from './WeekCalendarView';
import CalendarExport from './CalendarExport';
import useTravelSegmentStore from '../../stores/useTravelSegmentStore';
import { parseDateString } from '../../utils/dateFormat';

const CalendarView = ({ trip, destinations, pois, accommodations }) => {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState('month'); // 'month' or 'week'
  const [selectedDate, setSelectedDate] = useState(() => {
    // Default to trip start date or today
    return trip?.start_date ? parseDateString(trip.start_date) || new Date() : new Date();
  });

  // Fetch travel segments for transport icons
  const { segments, fetchTripSegments } = useTravelSegmentStore();

  useEffect(() => {
    if (trip?.id) {
      fetchTripSegments(trip.id);
    }
  }, [trip?.id, fetchTripSegments]);

  // Calculate trip date range
  const tripDateRange = useMemo(() => {
    if (!trip?.start_date || !trip?.end_date) return null;

    const startDate = parseDateString(trip.start_date);
    const endDate = parseDateString(trip.end_date);
    if (!startDate || !endDate) return null;

    return { startDate, endDate };
  }, [trip?.start_date, trip?.end_date]);

  // Organize POIs by date
  const poisByDate = useMemo(() => {
    const organized = {};

    if (!pois || pois.length === 0) return organized;

    pois.forEach(poi => {
      if (!poi.scheduled_date) return;

      const dateKey = poi.scheduled_date; // YYYY-MM-DD format
      if (!organized[dateKey]) {
        organized[dateKey] = [];
      }
      organized[dateKey].push(poi);
    });

    // Sort POIs within each date by day_order
    Object.keys(organized).forEach(dateKey => {
      organized[dateKey].sort((a, b) => (a.day_order || 0) - (b.day_order || 0));
    });

    return organized;
  }, [pois]);

  // Organize accommodations by date range
  const accommodationsByDate = useMemo(() => {
    const organized = {};

    if (!accommodations || accommodations.length === 0) return organized;

    accommodations.forEach(accommodation => {
      if (!accommodation.check_in_date || !accommodation.check_out_date) return;

      const checkIn = new Date(accommodation.check_in_date + 'T00:00:00');
      const checkOut = new Date(accommodation.check_out_date + 'T00:00:00');

      // Mark all nights this accommodation covers
      let currentDate = new Date(checkIn);
      while (currentDate < checkOut) {
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        const dateKey = `${year}-${month}-${day}`;
        if (!organized[dateKey]) {
          organized[dateKey] = [];
        }
        organized[dateKey].push(accommodation);
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });

    return organized;
  }, [accommodations]);

  // Organize destinations by date range
  const destinationsByDate = useMemo(() => {
    const organized = {};

    if (!destinations || destinations.length === 0) return organized;

    destinations.forEach(destination => {
      if (!destination.arrival_date) return;

      const dateKey = destination.arrival_date; // YYYY-MM-DD format
      if (!organized[dateKey]) {
        organized[dateKey] = [];
      }
      organized[dateKey].push({ ...destination, isArrival: true });

      if (destination.departure_date) {
        const depDateKey = destination.departure_date;
        if (!organized[depDateKey]) {
          organized[depDateKey] = [];
        }
        organized[depDateKey].push({ ...destination, isDeparture: true });
      }
    });

    return organized;
  }, [destinations]);

  const handleDateChange = (date) => {
    setSelectedDate(date);
  };

  if (!trip) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        <p>{t('calendar.noTripData')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <CalendarIcon className="w-6 h-6 text-gray-700 dark:text-gray-300" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {t('calendar.title')}
          </h2>
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setViewMode('month')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'month'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Grid3x3 className="w-4 h-4" />
              {t('calendar.month')}
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'week'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <UnorderedListIcon className="w-4 h-4" />
              {t('calendar.week')}
            </button>
          </div>

          {/* Export Button */}
          <CalendarExport
            trip={trip}
            destinations={destinations}
            pois={pois}
            accommodations={accommodations}
          />
        </div>
      </div>

      {/* Calendar Content */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'month' ? (
          <MonthCalendarView
            trip={trip}
            tripDateRange={tripDateRange}
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
            poisByDate={poisByDate}
            accommodationsByDate={accommodationsByDate}
            destinationsByDate={destinationsByDate}
            travelSegments={segments}
          />
        ) : (
          <WeekCalendarView
            trip={trip}
            tripDateRange={tripDateRange}
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
            poisByDate={poisByDate}
            accommodationsByDate={accommodationsByDate}
            destinationsByDate={destinationsByDate}
            destinations={destinations}
            pois={pois}
            travelSegments={segments}
          />
        )}
      </div>
    </div>
  );
};

export default CalendarView;
