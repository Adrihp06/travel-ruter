import React, { useEffect, useCallback } from 'react';
import { Calendar, Moon, Plus, Pencil, Trash2 } from 'lucide-react';
import useTravelSegmentStore from '../../stores/useTravelSegmentStore';
import { TravelSegmentCard } from '../TravelSegment';

const Timeline = ({
  destinations,
  tripId,
  onSelectDestination,
  selectedDestinationId,
  onAddDestination,
  onEditDestination,
  onDeleteDestination
}) => {
  const {
    segments,
    fetchTripSegments,
    calculateSegment,
    getSegment,
    calculatingSegments,
  } = useTravelSegmentStore();

  const calculateNights = (start, end) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate - startDate);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const sortedDestinations = [...destinations].sort(
    (a, b) => new Date(a.arrival_date) - new Date(b.arrival_date)
  );

  // Calculate total trip duration
  const tripStart = sortedDestinations[0]?.arrival_date;
  const tripEnd = sortedDestinations[sortedDestinations.length - 1]?.departure_date;
  const totalDays = tripStart && tripEnd ? calculateNights(tripStart, tripEnd) : 0;

  // Fetch travel segments when trip changes
  useEffect(() => {
    if (tripId) {
      fetchTripSegments(tripId);
    }
  }, [tripId, fetchTripSegments]);

  // Get travel segment to the next destination
  const getTravelToNext = useCallback((index) => {
    if (index >= sortedDestinations.length - 1) return null;
    const fromDest = sortedDestinations[index];
    const toDest = sortedDestinations[index + 1];
    return getSegment(fromDest.id, toDest.id);
  }, [sortedDestinations, getSegment]);

  // Handle mode change for a segment
  const handleModeChange = useCallback(async (fromId, toId, mode) => {
    await calculateSegment(fromId, toId, mode);
  }, [calculateSegment]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 w-80 overflow-y-auto transition-colors">
      {/* Trip Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Trip Route</h2>
          {onAddDestination && (
            <button
              onClick={onAddDestination}
              className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
              title="Add destination"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {totalDays} days total
        </p>
        {tripStart && tripEnd && (
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {new Date(tripStart).toLocaleDateString()} - {new Date(tripEnd).toLocaleDateString()}
          </p>
        )}
      </div>

      <div className="flex-1 p-4">
        {/* Start Marker */}
        <div className="flex items-center mb-2 text-xs text-gray-500 dark:text-gray-400">
          <span className="w-3 h-3 rounded-full border-2 border-green-500 mr-3"></span>
          <span>Start: {tripStart && new Date(tripStart).toLocaleDateString()}</span>
        </div>

        {/* Destinations with travel segments */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-1.5 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-600"></div>

          {sortedDestinations.map((dest, index) => {
            const isSelected = selectedDestinationId === dest.id;
            const nights = calculateNights(dest.arrival_date, dest.departure_date);
            const segment = getTravelToNext(index);
            const nextDest = sortedDestinations[index + 1];
            const segmentKey = nextDest ? `${dest.id}-${nextDest.id}` : null;
            const isCalculating = segmentKey ? calculatingSegments[segmentKey] || false : false;

            return (
              <div key={dest.id} className="group">
                {/* Destination Node */}
                <div
                  onClick={() => onSelectDestination(dest.id)}
                  className={`
                    relative pl-6 py-3 pr-2 cursor-pointer transition-all duration-200
                    ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/30 rounded-lg' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}
                  `}
                >
                  {/* Node marker */}
                  <span className={`
                    absolute left-0 top-4 w-3 h-3 rounded-full border-2 z-10
                    ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-white dark:bg-gray-800 border-indigo-400'}
                  `}></span>

                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-medium ${isSelected ? 'text-indigo-900 dark:text-indigo-300' : 'text-gray-900 dark:text-white'}`}>
                        {dest.name || dest.city_name}
                      </h3>
                      <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mt-1">
                        <Calendar className="w-3 h-3 mr-1" />
                        <span>{new Date(dest.arrival_date).toLocaleDateString()}</span>
                        <span className="mx-1">→</span>
                        <span>{new Date(dest.departure_date).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center text-xs font-medium text-indigo-600 dark:text-indigo-400 mt-1">
                        <Moon className="w-3 h-3 mr-1" />
                        {nights} nights
                      </div>
                    </div>

                    {/* Edit/Delete buttons */}
                    {(onEditDestination || onDeleteDestination) && (
                      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                        {onEditDestination && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditDestination(dest);
                            }}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                            title="Edit destination"
                          >
                            <Pencil className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                          </button>
                        )}
                        {onDeleteDestination && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteDestination(dest.id);
                            }}
                            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                            title="Delete destination"
                          >
                            <Trash2 className="w-3 h-3 text-red-500 dark:text-red-400" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Travel Segment to Next Destination */}
                {nextDest && (
                  <div className="relative pl-6 py-2">
                    <TravelSegmentCard
                      segment={segment}
                      fromCity={dest.name || dest.city_name}
                      toCity={nextDest.name || nextDest.city_name}
                      onModeChange={(mode) => handleModeChange(dest.id, nextDest.id, mode)}
                      isCalculating={isCalculating}
                      hasCoordinates={
                        dest.latitude != null && dest.longitude != null &&
                        nextDest.latitude != null && nextDest.longitude != null
                      }
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* End Marker */}
        <div className="flex items-center mt-2 text-xs text-gray-500 dark:text-gray-400">
          <span className="w-3 h-3 rounded-full border-2 border-red-500 mr-3"></span>
          <span>End: {tripEnd && new Date(tripEnd).toLocaleDateString()}</span>
        </div>

        {/* Add Destination Button */}
        {onAddDestination && (
          <button
            onClick={onAddDestination}
            className="w-full flex items-center justify-center space-x-2 p-3 mt-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:border-indigo-400 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Destination</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default Timeline;
