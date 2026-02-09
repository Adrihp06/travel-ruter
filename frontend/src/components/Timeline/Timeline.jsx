import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, Moon, Plus } from 'lucide-react';
import AirplaneIcon from '@/components/icons/airplane-icon';
import HomeIcon from '@/components/icons/home-icon';
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
import useTripStore from '../../stores/useTripStore';
import { TravelSegmentCard, TravelStopsList, AddTravelStopModal } from '../TravelSegment';
import TripWarningsPanel from './TripWarningsPanel';

const Timeline = ({
  destinations,
  tripId,
  trip, // Full trip object with origin/return info
  onSelectDestination,
  selectedDestinationId,
  onAddDestination,
  onEditDestination,
  onDeleteDestination,
  onReorderDestinations,
  accommodationsByDestination = {}, // Map of destination_id -> accommodations[]
}) => {
  const { t } = useTranslation();
  const [activeId, setActiveId] = useState(null);
  const [addStopModal, setAddStopModal] = useState({ isOpen: false, segmentId: null, existingStop: null });

  const {
    segments,
    originSegment,
    returnSegment,
    fetchTripSegments,
    calculateSegment,
    getSegment,
    calculatingSegments,
    hasFetchedInitial,
  } = useTravelSegmentStore();

  const { fetchStopsForSegments } = useTravelStopStore();
  const { updateTrip } = useTripStore();

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

  // Handle mode change for origin/return segments
  const handleOriginModeChange = useCallback(async (mode) => {
    if (!trip?.id) return;
    await updateTrip(trip.id, { origin_travel_mode: mode });
    await fetchTripSegments(trip.id);
  }, [trip?.id, updateTrip, fetchTripSegments]);

  const handleReturnModeChange = useCallback(async (mode) => {
    if (!trip?.id) return;
    await updateTrip(trip.id, { return_travel_mode: mode });
    await fetchTripSegments(trip.id);
  }, [trip?.id, updateTrip, fetchTripSegments]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 w-80 overflow-y-auto transition-colors">
      {/* Trip Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('timeline.tripRoute')}</h2>
          {onAddDestination && (
            <button
              onClick={onAddDestination}
              className="p-1.5 text-[#D97706] dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
              title={t('timeline.addDestination')}
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('timeline.daysTotal', { count: totalDays })}
        </p>
        {tripStart && tripEnd && (
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {formatDateShort(tripStart)} - {formatDateShort(tripEnd)}
          </p>
        )}
      </div>

      <div className="flex-1 p-4 pb-20">
        {/* Trip Warnings Panel - positioned under Trip Route header */}
        <TripWarningsPanel
          trip={trip}
          destinations={sortedDestinations}
          accommodationsByDestination={accommodationsByDestination}
        />

        {/* Origin Node - Start of Trip */}
        <div className="group relative pl-6 py-2.5">
          <span className="absolute left-0 top-3.5 w-3 h-3 rounded-full bg-green-500 border-2 border-green-500 z-10 shadow-sm"></span>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-green-100 dark:bg-green-900/30">
              <AirplaneIcon className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {trip?.origin_name || t('timeline.origin')}
              </h3>
              {tripStart && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDateShort(tripStart)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Origin to First Destination Segment */}
        {trip?.origin_name && sortedDestinations.length > 0 && (
          <div className="relative pl-6 py-1.5">
            <TravelSegmentCard
              segment={originSegment}
              fromCity={trip.origin_name}
              toCity={sortedDestinations[0]?.name || sortedDestinations[0]?.city_name}
              onModeChange={handleOriginModeChange}
              hasFetchedInitial={hasFetchedInitial}
              hasCoordinates={
                trip.origin_latitude != null && trip.origin_longitude != null &&
                sortedDestinations[0]?.latitude != null && sortedDestinations[0]?.longitude != null
              }
            />
          </div>
        )}

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
              <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg p-3 border-2 border-amber-400 opacity-90">
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

        {/* Last Destination to Return Segment */}
        {trip?.return_name && sortedDestinations.length > 0 && (
          <div className="relative pl-6 py-1.5 mt-1">
            <TravelSegmentCard
              segment={returnSegment}
              fromCity={sortedDestinations[sortedDestinations.length - 1]?.name || sortedDestinations[sortedDestinations.length - 1]?.city_name}
              toCity={trip.return_name}
              onModeChange={handleReturnModeChange}
              hasFetchedInitial={hasFetchedInitial}
              hasCoordinates={
                sortedDestinations[sortedDestinations.length - 1]?.latitude != null &&
                sortedDestinations[sortedDestinations.length - 1]?.longitude != null &&
                trip.return_latitude != null && trip.return_longitude != null
              }
            />
          </div>
        )}

        {/* Return Node - End of Trip */}
        <div className="group relative pl-6 py-2.5 mt-1">
          <span className="absolute left-0 top-3.5 w-3 h-3 rounded-full bg-red-500 border-2 border-red-500 z-10 shadow-sm"></span>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-red-100 dark:bg-red-900/30">
              <HomeIcon className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {trip?.return_name || t('timeline.return')}
              </h3>
              {tripEnd && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDateShort(tripEnd)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Add Destination Button */}
        {onAddDestination && (
          <button
            onClick={onAddDestination}
            className="w-full flex items-center justify-center space-x-2 p-3 mt-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:border-amber-400 dark:hover:border-[#D97706] hover:text-[#D97706] dark:hover:text-amber-400 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{t('timeline.addDestination')}</span>
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
