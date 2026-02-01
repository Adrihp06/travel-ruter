import React, { useEffect, useState, useCallback, useRef, useMemo, lazy, Suspense } from 'react';
import { Plus, Plane, SearchX, MapPin, Calendar, Compass, TrendingUp } from 'lucide-react';
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
    fetchTripsSummary,
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

    // duplicateTrip already adds the new trip to state and fetches destinations
    // No need to call fetchTrips() again - that causes duplicates
    // Let any errors propagate to the modal for display
    await duplicateTrip(trip.id, duplicateOptions);
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
    // Use optimized endpoint that fetches trips + destinations + POI stats in ONE call
    fetchTripsSummary();
  }, [fetchTripsSummary]);

  // Get filtered and sorted trips
  // Dependencies include all state that affects filtering results
  const filteredTrips = useMemo(
    () => getFilteredTrips(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trips, tripsWithDestinations, searchQuery, statusFilter, sortBy, showCompleted]
  );

  const activeFiltersCount = useMemo(
    () => getActiveFiltersCount(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchQuery, statusFilter, sortBy, showCompleted]
  );

  // Check if there are no results due to filtering
  const hasNoFilterResults = trips.length > 0 && filteredTrips.length === 0;

  // Calculate trip statistics for the summary cards
  const tripStats = useMemo(() => {
    const now = new Date();
    const activeTrips = trips.filter(t => t.status === 'planning' || t.status === 'booked');
    const upcomingTrips = trips.filter(t => {
      if (!t.start_date) return false;
      const startDate = new Date(t.start_date);
      return startDate > now && (t.status === 'planning' || t.status === 'booked');
    });
    const totalDestinations = tripsWithDestinations.reduce((sum, t) => sum + (t.destinations?.length || 0), 0);
    const totalPOIs = tripsWithDestinations.reduce((sum, t) => sum + (t.poiStats?.total_pois || 0), 0);

    return {
      totalTrips: trips.length,
      activeTrips: activeTrips.length,
      upcomingTrips: upcomingTrips.length,
      totalDestinations,
      totalPOIs,
    };
  }, [trips, tripsWithDestinations]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-50 via-amber-50/30 to-stone-100 dark:from-stone-900 dark:via-stone-900 dark:to-stone-800 relative overflow-y-auto transition-colors">
        {/* Breadcrumbs */}
        <div className="absolute top-6 left-6 z-50">
          <div className="bg-white/90 dark:bg-stone-800/90 backdrop-blur-sm px-4 py-2 rounded-xl shadow-sm border border-stone-200/80 dark:border-stone-700">
            <Breadcrumbs className="mb-0" />
          </div>
        </div>

        {/* Hero Section with Map - Skeleton */}
        <div className="relative">
          <div className="h-[500px] lg:h-[550px] relative">
            <MapSkeleton height="100%" />
            {/* Bottom gradient only - less intrusive */}
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-stone-50 dark:from-stone-900 to-transparent pointer-events-none" />
          </div>

          {/* Floating Header Card - Skeleton */}
          <div className="absolute bottom-0 left-0 right-0 transform translate-y-1/2 px-4 sm:px-6 lg:px-8 z-10">
            <div className="max-w-7xl mx-auto">
              <div className="bg-white/95 dark:bg-stone-800/95 backdrop-blur-md rounded-2xl shadow-xl border border-stone-200/50 dark:border-stone-700/50 p-6 lg:p-8">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                  <div>
                    <div className="h-10 w-48 bg-stone-200 dark:bg-stone-700 rounded-lg skeleton-shimmer mb-2" />
                    <div className="h-5 w-64 bg-stone-200 dark:bg-stone-700 rounded skeleton-shimmer" />
                  </div>
                  <div className="h-12 w-36 bg-stone-200 dark:bg-stone-700 rounded-xl skeleton-shimmer" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards - Skeleton */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 lg:pt-36 pb-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white dark:bg-stone-800 rounded-xl p-5 shadow-sm border border-stone-200/50 dark:border-stone-700/50">
                <div className="h-10 w-10 bg-stone-200 dark:bg-stone-700 rounded-lg skeleton-shimmer mb-3" />
                <div className="h-8 w-16 bg-stone-200 dark:bg-stone-700 rounded skeleton-shimmer mb-1" />
                <div className="h-4 w-24 bg-stone-200 dark:bg-stone-700 rounded skeleton-shimmer" />
              </div>
            ))}
          </div>

          {/* Search Bar - Skeleton */}
          <div className="mb-8 h-14 bg-white dark:bg-stone-800 rounded-xl skeleton-shimmer border border-stone-200/50 dark:border-stone-700/50" />

          {/* Section Divider */}
          <div className="flex items-center gap-4 mb-8">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-stone-300 dark:via-stone-600 to-transparent" />
            <div className="h-5 w-24 bg-stone-200 dark:bg-stone-700 rounded skeleton-shimmer" />
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-stone-300 dark:via-stone-600 to-transparent" />
          </div>

          {/* Trip Cards Grid - Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-8">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <TripCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-amber-50/30 to-stone-100 dark:from-stone-900 dark:via-stone-900 dark:to-stone-800 relative overflow-y-auto transition-colors">
      {/* Breadcrumbs */}
      <div className="absolute top-6 left-6 z-50">
        <div className="bg-white/90 dark:bg-stone-800/90 backdrop-blur-sm px-4 py-2 rounded-xl shadow-sm border border-stone-200/80 dark:border-stone-700">
          <Breadcrumbs className="mb-0" />
        </div>
      </div>

      {/* Hero Section with Map */}
      <div className="relative">
        <div className="h-[500px] lg:h-[550px] relative z-0">
          <MacroMap trips={tripsWithDestinations} />
          {/* Bottom gradient only - less intrusive, allows map interaction */}
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-stone-50 dark:from-stone-900 to-transparent pointer-events-none z-10" />
          {/* Subtle top gradient for breadcrumb visibility */}
          <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-stone-50/70 dark:from-stone-900/70 to-transparent pointer-events-none z-10" />
        </div>

        {/* Floating Header Card */}
        <div className="absolute bottom-0 left-0 right-0 transform translate-y-1/2 px-4 sm:px-6 lg:px-8 z-20">
          <div className="max-w-7xl mx-auto">
            <div className="bg-white/95 dark:bg-stone-800/95 backdrop-blur-md rounded-2xl shadow-xl border border-stone-200/50 dark:border-stone-700/50 p-6 lg:p-8">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div>
                  <h1 className="text-3xl lg:text-4xl font-bold text-stone-900 dark:text-stone-50 mb-2">
                    My Trips
                  </h1>
                  <p className="text-stone-600 dark:text-stone-400 text-lg">
                    {trips.length === 0
                      ? 'Start planning your next adventure'
                      : `${tripStats.totalTrips} trip${tripStats.totalTrips !== 1 ? 's' : ''} across ${tripStats.totalDestinations} destination${tripStats.totalDestinations !== 1 ? 's' : ''}`}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setEditingTrip(null);
                    setShowTripModal(true);
                  }}
                  className="flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl transition-all shadow-lg hover:shadow-xl press-effect font-semibold text-lg group"
                >
                  <Plus className="w-5 h-5 transition-transform group-hover:rotate-90" />
                  <span>New Trip</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 lg:pt-36 pb-12">
        {/* Stats Cards */}
        {trips.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10 animate-fade-in">
            <div className="bg-white dark:bg-stone-800 rounded-xl p-5 shadow-sm border border-stone-200/50 dark:border-stone-700/50 hover-lift group">
              <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Compass className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="text-2xl lg:text-3xl font-bold text-stone-900 dark:text-stone-50">
                {tripStats.totalTrips}
              </div>
              <div className="text-sm text-stone-500 dark:text-stone-400">Total Trips</div>
            </div>

            <div className="bg-white dark:bg-stone-800 rounded-xl p-5 shadow-sm border border-stone-200/50 dark:border-stone-700/50 hover-lift group">
              <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="text-2xl lg:text-3xl font-bold text-stone-900 dark:text-stone-50">
                {tripStats.activeTrips}
              </div>
              <div className="text-sm text-stone-500 dark:text-stone-400">Active Trips</div>
            </div>

            <div className="bg-white dark:bg-stone-800 rounded-xl p-5 shadow-sm border border-stone-200/50 dark:border-stone-700/50 hover-lift group">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <MapPin className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="text-2xl lg:text-3xl font-bold text-stone-900 dark:text-stone-50">
                {tripStats.totalDestinations}
              </div>
              <div className="text-sm text-stone-500 dark:text-stone-400">Destinations</div>
            </div>

            <div className="bg-white dark:bg-stone-800 rounded-xl p-5 shadow-sm border border-stone-200/50 dark:border-stone-700/50 hover-lift group">
              <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="text-2xl lg:text-3xl font-bold text-stone-900 dark:text-stone-50">
                {tripStats.upcomingTrips}
              </div>
              <div className="text-sm text-stone-500 dark:text-stone-400">Upcoming</div>
            </div>
          </div>
        )}

        {trips.length === 0 ? (
          <div className="text-center py-20 animate-fade-in">
            <div className="w-24 h-24 mx-auto mb-8 bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 rounded-full flex items-center justify-center shadow-lg">
              <Plane className="w-12 h-12 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-2xl font-bold text-stone-800 dark:text-stone-100 mb-3">No trips yet</h2>
            <p className="text-stone-500 dark:text-stone-400 mb-8 max-w-md mx-auto text-lg">
              Create your first trip to start planning your next adventure!
            </p>
            <button
              onClick={() => {
                setEditingTrip(null);
                setShowTripModal(true);
              }}
              className="px-8 py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl transition-all shadow-lg hover:shadow-xl press-effect font-semibold text-lg"
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

            {/* Section Divider */}
            <div className="flex items-center gap-4 my-8">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-stone-300 dark:via-stone-600 to-transparent" />
              <span className="text-sm font-medium text-stone-500 dark:text-stone-400 px-3">
                {filteredTrips.length} {filteredTrips.length === 1 ? 'trip' : 'trips'}
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-stone-300 dark:via-stone-600 to-transparent" />
            </div>

            {/* No results state */}
            {hasNoFilterResults ? (
              <div className="text-center py-20 animate-fade-in">
                <div className="w-24 h-24 mx-auto mb-8 bg-stone-100 dark:bg-stone-800 rounded-full flex items-center justify-center shadow-inner">
                  <SearchX className="w-12 h-12 text-stone-400 dark:text-stone-500" />
                </div>
                <h2 className="text-2xl font-bold text-stone-700 dark:text-stone-200 mb-3">No trips found</h2>
                <p className="text-stone-500 dark:text-stone-400 mb-8 max-w-md mx-auto text-lg">
                  {searchQuery
                    ? `No trips match "${searchQuery}"`
                    : !showCompleted
                      ? 'All your trips are completed or in the past. Show completed trips to see them.'
                      : 'No trips match your current filters'}
                </p>
                <button
                  onClick={() => !showCompleted ? setShowCompleted(true) : clearFilters()}
                  className="px-8 py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl transition-all shadow-lg hover:shadow-xl press-effect font-semibold text-lg"
                >
                  {!showCompleted && !searchQuery ? 'Show Completed Trips' : 'Clear Filters'}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-8 stagger-children">
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
              fetchTripsSummary();
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
