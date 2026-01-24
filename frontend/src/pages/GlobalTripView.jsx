import React, { useEffect, useState, useCallback, useRef, useMemo, lazy, Suspense } from 'react';
import { Plus, Plane, SearchX } from 'lucide-react';
import useTripStore from '../stores/useTripStore';
import MacroMap from '../components/Map/MacroMap';
import MapSkeleton from '../components/Map/MapSkeleton';
import Breadcrumbs from '../components/Layout/Breadcrumbs';
import { DeleteTripDialog, UndoToast, TripCard, TripSearchFilter } from '../components/Trip';
import TripCardSkeleton from '../components/Trip/TripCardSkeleton';

// Lazy load heavy modal components
const TripFormModal = lazy(() => import('../components/Trip/TripFormModal'));
const TripDuplicateModal = lazy(() => import('../components/Trip/TripDuplicateModal'));

const UNDO_DURATION = 5000; // 5 seconds for undo

const GlobalTripView = () => {
  const {
    trips,
    tripsWithDestinations,
    fetchTrips,
    softDeleteTrip,
    restoreTrip,
    confirmDeleteTrip,
    duplicateTrip,
    isLoading,
    // Filter state and actions
    searchQuery,
    statusFilter,
    sortBy,
    showCompleted,
    setSearchQuery,
    setStatusFilter,
    setSortBy,
    setShowCompleted,
    clearFilters,
    getFilteredTrips,
    getActiveFiltersCount,
  } = useTripStore();
  const [showTripModal, setShowTripModal] = useState(false);
  const [editingTrip, setEditingTrip] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ isOpen: false, trip: null });
  const [duplicateDialog, setDuplicateDialog] = useState({ isOpen: false, trip: null });
  const [undoToast, setUndoToast] = useState({ isVisible: false, tripName: '', tripId: null });
  const [isDeleting, setIsDeleting] = useState(false);
  const undoTimeoutRef = useRef(null);

  // Open delete confirmation dialog - memoized
  const handleDeleteClick = useCallback((tripId) => {
    // Find trip with destinations for showing destination count
    const trip = trips.find(t => t.id === tripId);
    const tripWithDest = tripsWithDestinations.find(t => t.id === tripId);
    setDeleteDialog({
      isOpen: true,
      trip: tripWithDest || trip
    });
  }, [trips, tripsWithDestinations]);

  // Handle delete confirmation
  const handleConfirmDelete = useCallback(async () => {
    const trip = deleteDialog.trip;
    if (!trip) return;

    setIsDeleting(true);
    const tripName = trip.title || trip.name || 'Trip';

    // Soft delete (remove from UI)
    softDeleteTrip(trip.id);

    // Close dialog
    setDeleteDialog({ isOpen: false, trip: null });
    setIsDeleting(false);

    // Show undo toast
    setUndoToast({ isVisible: true, tripName, tripId: trip.id });

    // Set timeout for permanent deletion
    undoTimeoutRef.current = setTimeout(async () => {
      try {
        await confirmDeleteTrip(trip.id);
      } catch (error) {
        console.error('Failed to delete trip:', error);
      }
      setUndoToast({ isVisible: false, tripName: '', tripId: null });
    }, UNDO_DURATION);
  }, [deleteDialog.trip, softDeleteTrip, confirmDeleteTrip]);

  // Handle undo
  const handleUndo = useCallback(() => {
    // Clear the deletion timeout
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }

    // Restore the trip
    restoreTrip();

    // Hide toast
    setUndoToast({ isVisible: false, tripName: '', tripId: null });
  }, [restoreTrip]);

  // Handle toast dismiss (proceed with deletion)
  const handleDismissToast = useCallback(async () => {
    // Clear timeout if it exists
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }

    const tripId = undoToast.tripId;
    setUndoToast({ isVisible: false, tripName: '', tripId: null });

    // Proceed with deletion
    if (tripId) {
      try {
        await confirmDeleteTrip(tripId);
      } catch (error) {
        console.error('Failed to delete trip:', error);
      }
    }
  }, [undoToast.tripId, confirmDeleteTrip]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
    };
  }, []);

  // Memoized callbacks to prevent unnecessary re-renders of TripCard components
  const handleEditTrip = useCallback((trip) => {
    setEditingTrip(trip);
    setShowTripModal(true);
  }, []);

  const handleDuplicateClick = useCallback((trip) => {
    setDuplicateDialog({ isOpen: true, trip });
  }, []);

  const handleDuplicateTrip = useCallback(async (duplicateOptions) => {
    const trip = duplicateDialog.trip;
    if (!trip) return;

    try {
      // duplicateTrip already adds the new trip to state and fetches destinations
      // No need to call fetchTrips() again - that causes duplicates
      await duplicateTrip(trip.id, duplicateOptions);
    } catch (error) {
      throw error; // Let the modal handle the error display
    }
  }, [duplicateDialog.trip, duplicateTrip]);

  const handleStatusChange = useCallback(async (trip, newStatus) => {
    try {
      await useTripStore.getState().updateTrip(trip.id, { ...trip, status: newStatus });
    } catch (error) {
      alert('Failed to update trip status: ' + error.message);
    }
  }, []);

  const handleShareTrip = useCallback((trip) => {
    // Copy trip link to clipboard
    const tripUrl = `${window.location.origin}/trips/${trip.id}`;
    navigator.clipboard.writeText(tripUrl).then(() => {
      alert('Trip link copied to clipboard!');
    }).catch(() => {
      alert('Failed to copy link');
    });
  }, []);

  const handleExportTrip = useCallback((trip) => {
    // Export trip data as JSON
    const tripData = {
      name: trip.name || trip.title,
      location: trip.location,
      description: trip.description,
      start_date: trip.start_date,
      end_date: trip.end_date,
      total_budget: trip.total_budget,
      currency: trip.currency,
      status: trip.status,
    };
    const blob = new Blob([JSON.stringify(tripData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(trip.name || trip.title || 'trip').replace(/\s+/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  // Memoize trip stats lookup maps for O(1) access instead of O(n) find() calls
  const tripStatsMap = useMemo(() => {
    const statsMap = {};
    tripsWithDestinations.forEach(trip => {
      statsMap[trip.id] = {
        destinationCount: trip.destinations?.length || 0,
        poiStats: trip.poiStats || { total_pois: 0, scheduled_pois: 0 },
      };
    });
    return statsMap;
  }, [tripsWithDestinations]);

  // Get destination count for a trip (O(1) lookup)
  const getDestinationCount = useCallback((tripId) => {
    return tripStatsMap[tripId]?.destinationCount || 0;
  }, [tripStatsMap]);

  // Get POI stats for a trip (O(1) lookup)
  const getPOIStats = useCallback((tripId) => {
    return tripStatsMap[tripId]?.poiStats || { total_pois: 0, scheduled_pois: 0 };
  }, [tripStatsMap]);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  // Get filtered and sorted trips
  const filteredTrips = useMemo(
    () => getFilteredTrips(),
    [trips, searchQuery, statusFilter, sortBy, showCompleted, getFilteredTrips]
  );

  const activeFiltersCount = useMemo(
    () => getActiveFiltersCount(),
    [searchQuery, statusFilter, sortBy, showCompleted, getActiveFiltersCount]
  );

  // Check if there are no results due to filtering
  const hasNoFilterResults = trips.length > 0 && filteredTrips.length === 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-50 dark:bg-stone-900 p-8 pt-24 relative overflow-y-auto transition-colors">
        <div className="absolute top-6 left-6 z-50">
          <div className="bg-white/90 dark:bg-stone-800/90 backdrop-blur-sm px-4 py-2 rounded-xl shadow-sm border border-stone-200/80 dark:border-stone-700">
            <Breadcrumbs className="mb-0" />
          </div>
        </div>

        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-stone-900 dark:text-stone-50">My Trips</h1>
            <div className="w-32 h-10 bg-stone-200 dark:bg-stone-700 rounded-lg skeleton-shimmer" />
          </div>

          <div className="mb-10 h-[450px] rounded-2xl overflow-hidden shadow-md border border-stone-200 dark:border-stone-700">
            <MapSkeleton height="100%" />
          </div>

          <div className="mb-8 h-12 bg-stone-200 dark:bg-stone-700 rounded-lg skeleton-shimmer" />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <TripCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-900 p-8 pt-24 relative overflow-y-auto transition-colors">
      <div className="absolute top-6 left-6 z-50">
        <div className="bg-white/90 dark:bg-stone-800/90 backdrop-blur-sm px-4 py-2 rounded-xl shadow-sm border border-stone-200/80 dark:border-stone-700">
          <Breadcrumbs className="mb-0" />
        </div>
      </div>

      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-stone-900 dark:text-stone-50">My Trips</h1>
          <button
            onClick={() => {
              setEditingTrip(null);
              setShowTripModal(true);
            }}
            className="flex items-center space-x-2 px-4 py-2.5 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-all shadow-md hover:shadow-lg press-effect font-medium"
          >
            <Plus className="w-5 h-5" />
            <span>New Trip</span>
          </button>
        </div>

        <div className="mb-10 h-[450px] rounded-2xl overflow-hidden shadow-lg border border-stone-200 dark:border-stone-700">
          <MacroMap trips={tripsWithDestinations} />
        </div>

        {trips.length === 0 ? (
          <div className="text-center py-16 animate-fade-in">
            <div className="w-20 h-20 mx-auto mb-6 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
              <Plane className="w-10 h-10 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-xl font-semibold text-stone-700 dark:text-stone-200 mb-2">No trips yet</h2>
            <p className="text-stone-500 dark:text-stone-400 mb-6 max-w-sm mx-auto">Create your first trip to start planning your next adventure!</p>
            <button
              onClick={() => {
                setEditingTrip(null);
                setShowTripModal(true);
              }}
              className="px-6 py-3 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-all shadow-md hover:shadow-lg press-effect font-medium"
            >
              Create Your First Trip
            </button>
          </div>
        ) : (
          <>
            {/* Search and Filter Controls */}
            <TripSearchFilter
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              sortBy={sortBy}
              onSortChange={setSortBy}
              showCompleted={showCompleted}
              onShowCompletedChange={setShowCompleted}
              activeFiltersCount={activeFiltersCount}
              onClearFilters={clearFilters}
            />

            {/* No results state */}
            {hasNoFilterResults ? (
              <div className="text-center py-16 animate-fade-in">
                <div className="w-20 h-20 mx-auto mb-6 bg-stone-100 dark:bg-stone-800 rounded-full flex items-center justify-center">
                  <SearchX className="w-10 h-10 text-stone-400 dark:text-stone-500" />
                </div>
                <h2 className="text-xl font-semibold text-stone-700 dark:text-stone-200 mb-2">No trips found</h2>
                <p className="text-stone-500 dark:text-stone-400 mb-6 max-w-sm mx-auto">
                  {searchQuery
                    ? `No trips match "${searchQuery}"`
                    : 'No trips match your current filters'}
                </p>
                <button
                  onClick={clearFilters}
                  className="px-6 py-3 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-all shadow-md hover:shadow-lg press-effect font-medium"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredTrips.map((trip) => {
                  const poiStats = getPOIStats(trip.id);
                  return (
                    <TripCard
                      key={trip.id}
                      trip={trip}
                      onEdit={handleEditTrip}
                      onDelete={handleDeleteClick}
                      onDuplicate={handleDuplicateClick}
                      onStatusChange={handleStatusChange}
                      onShare={handleShareTrip}
                      onExport={handleExportTrip}
                      destinationCount={getDestinationCount(trip.id)}
                      totalPOIs={poiStats.total_pois}
                      scheduledPOIs={poiStats.scheduled_pois}
                    />
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Trip Form Modal - Lazy loaded */}
      <Suspense fallback={null}>
        {showTripModal && (
          <TripFormModal
            isOpen={showTripModal}
            onClose={() => {
              setShowTripModal(false);
              setEditingTrip(null);
            }}
            trip={editingTrip}
            onSuccess={() => {
              fetchTrips();
            }}
          />
        )}
      </Suspense>

      <DeleteTripDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, trip: null })}
        trip={deleteDialog.trip}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />

      {/* Trip Duplicate Modal - Lazy loaded */}
      <Suspense fallback={null}>
        {duplicateDialog.isOpen && (
          <TripDuplicateModal
            isOpen={duplicateDialog.isOpen}
            onClose={() => setDuplicateDialog({ isOpen: false, trip: null })}
            trip={duplicateDialog.trip}
            onDuplicate={handleDuplicateTrip}
          />
        )}
      </Suspense>

      {undoToast.isVisible && (
        <UndoToast
          message={`"${undoToast.tripName}" deleted`}
          onUndo={handleUndo}
          onDismiss={handleDismissToast}
          duration={UNDO_DURATION}
        />
      )}
    </div>
  );
};

export default GlobalTripView;
