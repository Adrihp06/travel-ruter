import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Moon, Plus } from 'lucide-react';
import { formatDateShort } from '../../utils/dateFormat';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import SortableDestinationItem from './SortableDestinationItem';
import useTravelSegmentStore from '../../stores/useTravelSegmentStore';
import useTravelStopStore from '../../stores/useTravelStopStore';
import { TravelSegmentCard, TravelStopsList, AddTravelStopModal } from '../TravelSegment';

const Timeline = ({
  destinations,
  tripId,
  onSelectDestination,
  selectedDestinationId,
  onAddDestination,
  onEditDestination,
  onDeleteDestination,
  onReorderDestinations,
}) => {
  const [activeId, setActiveId] = useState(null);
  const [addStopModal, setAddStopModal] = useState({ isOpen: false, segmentId: null, existingStop: null });

  const {
    segments,
    fetchTripSegments,
    calculateSegment,
    getSegment,
    calculatingSegments,
    hasFetchedInitial,
  } = useTravelSegmentStore();

  const { fetchStopsForSegments } = useTravelStopStore();

  // Configure sensors for pointer, touch, and keyboard interactions
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px drag before activation to allow clicks
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200, // 200ms touch delay before drag starts
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const calculateNights = (start, end) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate - startDate);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Destinations come pre-sorted by order_index from the API
  const sortedDestinations = [...destinations].sort(
    (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
  );

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      const oldIndex = sortedDestinations.findIndex((d) => d.id === active.id);
      const newIndex = sortedDestinations.findIndex((d) => d.id === over.id);
      const newOrder = arrayMove(sortedDestinations, oldIndex, newIndex);
      const newOrderIds = newOrder.map((d) => d.id);

      if (onReorderDestinations) {
        onReorderDestinations(newOrderIds);
      }
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const activeDestination = activeId
    ? sortedDestinations.find((d) => d.id === activeId)
    : null;

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

  // Fetch travel stops when segments are loaded
  useEffect(() => {
    if (segments.length > 0) {
      const segmentIds = segments.map(s => s.id);
      fetchStopsForSegments(segmentIds);
    }
  }, [segments, fetchStopsForSegments]);

  // Handle opening the add stop modal
  const handleAddStop = useCallback((segmentId, existingStop = null) => {
    setAddStopModal({ isOpen: true, segmentId, existingStop });
  }, []);

  // Handle closing the add stop modal
  const handleCloseStopModal = useCallback(() => {
    setAddStopModal({ isOpen: false, segmentId: null, existingStop: null });
  }, []);

  // Handle when a stop is saved (created/updated) - refetch segments to get updated route
  const handleStopSaved = useCallback(() => {
    if (tripId) {
      fetchTripSegments(tripId);
    }
    handleCloseStopModal();
  }, [tripId, fetchTripSegments, handleCloseStopModal]);

  // Get travel segment to the next destination
  const getTravelToNext = useCallback((index) => {
    if (index >= sortedDestinations.length - 1) return null;
    const fromDest = sortedDestinations[index];
    const toDest = sortedDestinations[index + 1];
    return getSegment(fromDest.id, toDest.id);
  }, [sortedDestinations, getSegment, segments]);

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
            {formatDateShort(tripStart)} - {formatDateShort(tripEnd)}
          </p>
        )}
      </div>

      <div className="flex-1 p-4">
        {/* Start Marker */}
        <div className="flex items-center mb-2 text-xs text-gray-500 dark:text-gray-400">
          <span className="w-3 h-3 rounded-full border-2 border-green-500 mr-3"></span>
          <span>Start: {tripStart && formatDateShort(tripStart)}</span>
        </div>

        {/* Destinations with travel segments */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-1.5 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-600"></div>

            <SortableContext
              items={sortedDestinations.map((d) => d.id)}
              strategy={verticalListSortingStrategy}
            >
              {sortedDestinations.map((dest, index) => {
                const isSelected = selectedDestinationId === dest.id;
                const nights = calculateNights(dest.arrival_date, dest.departure_date);
                const segment = getTravelToNext(index);
                const nextDest = sortedDestinations[index + 1];
                const segmentKey = nextDest ? `${dest.id}-${nextDest.id}` : null;
                const isCalculating = segmentKey ? calculatingSegments[segmentKey] || false : false;

                return (
                  <div key={dest.id}>
                    <SortableDestinationItem
                      destination={dest}
                      isSelected={isSelected}
                      nights={nights}
                      onSelect={onSelectDestination}
                      onEdit={onEditDestination}
                      onDelete={onDeleteDestination}
                    />

                    {/* Travel Segment to Next Destination */}
                    {nextDest && (
                      <div className="relative pl-6 py-2">
                        <TravelSegmentCard
                          segment={segment}
                          fromCity={dest.name || dest.city_name}
                          toCity={nextDest.name || nextDest.city_name}
                          onModeChange={(mode) => handleModeChange(dest.id, nextDest.id, mode)}
                          isCalculating={isCalculating}
                          hasFetchedInitial={hasFetchedInitial}
                          hasCoordinates={
                            dest.latitude != null && dest.longitude != null &&
                            nextDest.latitude != null && nextDest.longitude != null
                          }
                        />
                        {/* Travel Stops for this segment */}
                        {segment && (
                          <TravelStopsList
                            segmentId={segment.id}
                            onAddStop={(existingStop) => handleAddStop(segment.id, existingStop)}
                            onStopChanged={() => tripId && fetchTripSegments(tripId)}
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </SortableContext>
          </div>

          {/* Drag Overlay for visual preview */}
          <DragOverlay>
            {activeDestination ? (
              <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg p-3 border-2 border-indigo-400 opacity-90">
                <h3 className="font-medium text-gray-900 dark:text-white">
                  {activeDestination.name || activeDestination.city_name}
                </h3>
                <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mt-1">
                  <Calendar className="w-3 h-3 mr-1" />
                  <span>{formatDateShort(activeDestination.arrival_date)}</span>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* End Marker */}
        <div className="flex items-center mt-2 text-xs text-gray-500 dark:text-gray-400">
          <span className="w-3 h-3 rounded-full border-2 border-red-500 mr-3"></span>
          <span>End: {tripEnd && formatDateShort(tripEnd)}</span>
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

      {/* Add Travel Stop Modal */}
      <AddTravelStopModal
        isOpen={addStopModal.isOpen}
        onClose={handleCloseStopModal}
        onSaved={handleStopSaved}
        segmentId={addStopModal.segmentId}
        existingStop={addStopModal.existingStop}
      />
    </div>
  );
};

export default Timeline;
