import React, { useEffect, useState, useCallback, useRef, useMemo, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, MapPin, Calendar, Compass, TrendingUp, UserPlus } from 'lucide-react';
import useTripStore from '../stores/useTripStore';
import useAuthStore from '../stores/useAuthStore';
import useCollaborationStore from '../stores/useCollaborationStore';
import MacroMap from '../components/Map/MacroMap';
import MapPlaceholder from '../components/Map/MapPlaceholder';
import Breadcrumbs from '../components/Layout/Breadcrumbs';
import { DeleteTripDialog, UndoToast, TripCard, TripSearchFilter } from '../components/Trip';
import TripCardSkeleton from '../components/Trip/TripCardSkeleton';
import EmptyState from '../components/UI/EmptyState';
import PendingInvitations from '../components/Collaboration/PendingInvitations';
import { useToast } from '../components/common/Toast';

// Lazy load heavy modal components
const TripFormModal = lazy(() => import('../components/Trip/TripFormModal'));
const TripDuplicateModal = lazy(() => import('../components/Trip/TripDuplicateModal'));

const UNDO_DURATION = 5000; // 5 seconds for undo

const GlobalTripView = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const {
    tripsWithDestinations,
    fetchTripsSummary,
    softDeleteTrip,
    restoreTrip,
    confirmDeleteTrip,
    duplicateTrip,
    claimTrip,
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
  const { isAuthenticated } = useAuthStore();
  const { fetchPendingInvitations } = useCollaborationStore();

  // Use tripsWithDestinations as the single source of truth
  const trips = tripsWithDestinations;
  const [showTripModal, setShowTripModal] = useState(false);
  const [editingTrip, setEditingTrip] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ isOpen: false, trip: null });
  const [duplicateDialog, setDuplicateDialog] = useState({ isOpen: false, trip: null });
  const [undoToast, setUndoToast] = useState({ isVisible: false, tripName: '', tripId: null });
  const [isDeleting, setIsDeleting] = useState(false);
  const undoTimeoutRef = useRef(null);

  // Open delete confirmation dialog - memoized
  const handleDeleteClick = useCallback((tripId) => {
    // Find trip from single source of truth (already has destinations)
    const trip = tripsWithDestinations.find(t => t.id === tripId);
    setDeleteDialog({
      isOpen: true,
      trip
    });
  }, [tripsWithDestinations]);

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
      toast.error(error.message);
    }
  }, [toast]);

  const handleShareTrip = useCallback((trip) => {
    const tripUrl = `${window.location.origin}/trips/${trip.id}`;
    navigator.clipboard.writeText(tripUrl).then(() => {
      toast.success(t('globalTripView.linkCopied'));
    }).catch(() => {
      toast.error(t('globalTripView.failedCopyLink'));
    });
  }, [toast, t]);

  const handleClaimTrip = useCallback(async (tripId) => {
    try {
      await claimTrip(tripId);
    } catch (error) {
      console.error('Failed to claim trip:', error);
    }
  }, [claimTrip]);

  const handleInvitationAccepted = useCallback(async () => {
    await fetchTripsSummary();
    await fetchPendingInvitations();
  }, [fetchTripsSummary, fetchPendingInvitations]);

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
            <MapPlaceholder height="100%" />
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
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="bg-white dark:bg-stone-800 rounded-xl p-5 shadow-sm border border-stone-200/50 dark:border-stone-700/50">
                <div className="h-10 w-10 bg-stone-200 dark:bg-stone-700 rounded-lg skeleton-shimmer mb-3" style={{ animationDelay: `${i * 0.1}s` }} />
                <div className="h-8 w-16 bg-stone-200 dark:bg-stone-700 rounded skeleton-shimmer mb-1" style={{ animationDelay: `${i * 0.1 + 0.05}s` }} />
                <div className="h-4 w-24 bg-stone-200 dark:bg-stone-700 rounded skeleton-shimmer" style={{ animationDelay: `${i * 0.1 + 0.1}s` }} />
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
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <TripCardSkeleton key={i} index={i} />
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
                    {t('globalTripView.title')}
                  </h1>
                  <p className="text-stone-600 dark:text-stone-400 text-lg">
                    {trips.length === 0
                      ? t('globalTripView.startPlanning')
                      : t('globalTripView.tripSummary', { trips: tripStats.totalTrips, destinations: tripStats.totalDestinations })}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setEditingTrip(null);
                    setShowTripModal(true);
                  }}
                  className="flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl shadow-lg btn-interactive btn-ripple font-semibold text-lg group"
                >
                  <Plus className="w-5 h-5 icon-hover-rotate" />
                  <span>{t('globalTripView.newTrip')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 lg:pt-36 pb-12">
        {/* Pending Trip Invitations */}
        {isAuthenticated && <PendingInvitations onAccepted={handleInvitationAccepted} />}

        {/* Stats Cards */}
        {trips.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10 animate-fade-in">
            <div className="bg-white dark:bg-stone-800 rounded-xl p-5 shadow-sm border border-stone-200/50 dark:border-stone-700/50 hover-lift group">
              <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Compass className="w-5 h-5 text-amber-600 dark:text-amber-400 icon-hover-wiggle" />
              </div>
              <div className="text-2xl lg:text-3xl font-bold text-stone-900 dark:text-stone-50">
                {tripStats.totalTrips}
              </div>
              <div className="text-sm text-stone-500 dark:text-stone-400">{t('globalTripView.totalTrips')}</div>
            </div>

            <div className="bg-white dark:bg-stone-800 rounded-xl p-5 shadow-sm border border-stone-200/50 dark:border-stone-700/50 hover-lift group">
              <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400 icon-hover-bounce" />
              </div>
              <div className="text-2xl lg:text-3xl font-bold text-stone-900 dark:text-stone-50">
                {tripStats.activeTrips}
              </div>
              <div className="text-sm text-stone-500 dark:text-stone-400">{t('globalTripView.activeTrips')}</div>
            </div>

            <div className="bg-white dark:bg-stone-800 rounded-xl p-5 shadow-sm border border-stone-200/50 dark:border-stone-700/50 hover-lift group">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <MapPin className="w-5 h-5 text-blue-600 dark:text-blue-400 icon-hover-bounce" />
              </div>
              <div className="text-2xl lg:text-3xl font-bold text-stone-900 dark:text-stone-50">
                {tripStats.totalDestinations}
              </div>
              <div className="text-sm text-stone-500 dark:text-stone-400">{t('globalTripView.destinations')}</div>
            </div>

            <div className="bg-white dark:bg-stone-800 rounded-xl p-5 shadow-sm border border-stone-200/50 dark:border-stone-700/50 hover-lift group">
              <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400 icon-hover-wiggle" />
              </div>
              <div className="text-2xl lg:text-3xl font-bold text-stone-900 dark:text-stone-50">
                {tripStats.upcomingTrips}
              </div>
              <div className="text-sm text-stone-500 dark:text-stone-400">{t('globalTripView.upcoming')}</div>
            </div>
          </div>
        )}

        {trips.length === 0 ? (
          <EmptyState
            type="trips"
            size="lg"
            title={t('globalTripView.emptyTitle')}
            description={t('globalTripView.emptyDescription')}
            actionLabel={t('globalTripView.emptyAction')}
            onAction={() => {
              setEditingTrip(null);
              setShowTripModal(true);
            }}
          />
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
                {t('globalTripView.tripCount', { count: filteredTrips.length })}
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-stone-300 dark:via-stone-600 to-transparent" />
            </div>

            {/* No results state */}
            {hasNoFilterResults ? (
              <EmptyState
                type="search"
                size="lg"
                title={t('globalTripView.noMatchingTrips')}
                description={
                  searchQuery
                    ? t('globalTripView.noMatchingSearch', { query: searchQuery })
                    : !showCompleted
                      ? t('globalTripView.allCompleted')
                      : t('globalTripView.noFilterResults')
                }
                actionLabel={!showCompleted && !searchQuery ? t('globalTripView.showCompleted') : t('globalTripView.clearFilters')}
                onAction={() => !showCompleted && !searchQuery ? setShowCompleted(true) : clearFilters()}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-8 stagger-children">
                {filteredTrips.map((trip) => {
                  const poiStats = getPOIStats(trip.id);
                  return (
                    <div key={trip.id} className="relative">
                      <TripCard
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
                      {isAuthenticated && trip.user_id == null && (
                        <button
                          onClick={() => handleClaimTrip(trip.id)}
                          className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded-lg shadow-md transition-colors"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          {t('globalTripView.claim')}
                        </button>
                      )}
                    </div>
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
