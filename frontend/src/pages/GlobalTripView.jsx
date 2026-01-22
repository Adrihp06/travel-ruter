import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Plus, Plane, SearchX } from 'lucide-react';
import useTripStore from '../stores/useTripStore';
import MacroMap from '../components/Map/MacroMap';
import Breadcrumbs from '../components/Layout/Breadcrumbs';
import { TripFormModal, DeleteTripDialog, UndoToast, TripCard, TripSearchFilter } from '../components/Trip';

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
  const [undoToast, setUndoToast] = useState({ isVisible: false, tripName: '', tripId: null });
  const [isDeleting, setIsDeleting] = useState(false);
  const undoTimeoutRef = useRef(null);

  // Open delete confirmation dialog
  const handleDeleteClick = (tripId) => {
    // Find trip with destinations for showing destination count
    const trip = trips.find(t => t.id === tripId);
    const tripWithDest = tripsWithDestinations.find(t => t.id === tripId);
    setDeleteDialog({
      isOpen: true,
      trip: tripWithDest || trip
    });
  };

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

  const handleEditTrip = (trip) => {
    setEditingTrip(trip);
    setShowTripModal(true);
  };

  const handleDuplicateTrip = async (trip) => {
    try {
      await duplicateTrip(trip);
    } catch (error) {
      alert('Failed to duplicate trip: ' + error.message);
    }
  };

  const handleStatusChange = async (trip, newStatus) => {
    try {
      await useTripStore.getState().updateTrip(trip.id, { ...trip, status: newStatus });
    } catch (error) {
      alert('Failed to update trip status: ' + error.message);
    }
  };

  const handleShareTrip = (trip) => {
    // Copy trip link to clipboard
    const tripUrl = `${window.location.origin}/trips/${trip.id}`;
    navigator.clipboard.writeText(tripUrl).then(() => {
      alert('Trip link copied to clipboard!');
    }).catch(() => {
      alert('Failed to copy link');
    });
  };

  const handleExportTrip = (trip) => {
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
  };

  // Get destination count for a trip
  const getDestinationCount = (tripId) => {
    const tripWithDests = tripsWithDestinations.find(t => t.id === tripId);
    return tripWithDests?.destinations?.length || 0;
  };

  // Get POI stats for a trip
  const getPOIStats = (tripId) => {
    const tripWithDests = tripsWithDestinations.find(t => t.id === tripId);
    return tripWithDests?.poiStats || { total_pois: 0, scheduled_pois: 0 };
  };

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
    return <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading trips...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8 pt-24 relative overflow-y-auto transition-colors">
      <div className="absolute top-6 left-6 z-50">
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm px-4 py-2 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <Breadcrumbs className="mb-0" />
        </div>
      </div>

      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Trips</h1>
          <button
            onClick={() => {
              setEditingTrip(null);
              setShowTripModal(true);
            }}
            className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            <span>New Trip</span>
          </button>
        </div>

        <div className="mb-10 h-[450px] rounded-2xl overflow-hidden shadow-md border border-gray-200 dark:border-gray-700">
          <MacroMap trips={tripsWithDestinations} />
        </div>

        {trips.length === 0 ? (
          <div className="text-center py-16">
            <Plane className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-600 dark:text-gray-300 mb-2">No trips yet</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Create your first trip to get started!</p>
            <button
              onClick={() => {
                setEditingTrip(null);
                setShowTripModal(true);
              }}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
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
              <div className="text-center py-16">
                <SearchX className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-600 dark:text-gray-300 mb-2">No trips found</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  {searchQuery
                    ? `No trips match "${searchQuery}"`
                    : 'No trips match your current filters'}
                </p>
                <button
                  onClick={clearFilters}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
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
                      onDuplicate={handleDuplicateTrip}
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

      <DeleteTripDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, trip: null })}
        trip={deleteDialog.trip}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />

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
