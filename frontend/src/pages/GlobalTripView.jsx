import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, ArrowRight, Plus, Pencil, Trash2, Plane } from 'lucide-react';
import useTripStore from '../stores/useTripStore';
import MacroMap from '../components/Map/MacroMap';
import Breadcrumbs from '../components/Layout/Breadcrumbs';
import { TripFormModal, DeleteTripDialog, UndoToast } from '../components/Trip';

const UNDO_DURATION = 5000; // 5 seconds for undo

const GlobalTripView = () => {
  const {
    trips,
    tripsWithDestinations,
    fetchTrips,
    softDeleteTrip,
    restoreTrip,
    confirmDeleteTrip,
    isLoading
  } = useTripStore();
  const [showTripModal, setShowTripModal] = useState(false);
  const [editingTrip, setEditingTrip] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ isOpen: false, trip: null });
  const [undoToast, setUndoToast] = useState({ isVisible: false, tripName: '', tripId: null });
  const [isDeleting, setIsDeleting] = useState(false);
  const undoTimeoutRef = useRef(null);

  // Open delete confirmation dialog
  const handleDeleteClick = (trip) => {
    // Find trip with destinations for showing destination count
    const tripWithDest = tripsWithDestinations.find(t => t.id === trip.id);
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

  // Format date for display (handles both API format and mock data)
  const formatTripDate = (trip) => {
    if (trip.date) return trip.date; // Mock data format
    if (trip.start_date) {
      const date = new Date(trip.start_date);
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }
    return '';
  };

  // Get trip title (handles both API format and mock data)
  const getTripTitle = (trip) => trip.title || trip.name || 'Untitled Trip';

  // Get trip description
  const getTripDescription = (trip) => {
    if (trip.description) return trip.description;
    if (trip.location) return `Exploring ${trip.location} and surrounding areas.`;
    return 'Plan your adventure!';
  };

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Loading trips...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8 pt-24 relative overflow-y-auto">
      <div className="absolute top-6 left-6 z-50">
        <div className="bg-white/80 backdrop-blur-sm px-4 py-2 rounded-xl shadow-sm border border-gray-100">
          <Breadcrumbs className="mb-0" />
        </div>
      </div>

      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Trips</h1>
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

        <div className="mb-10 h-[450px] rounded-2xl overflow-hidden shadow-md border border-gray-200">
          <MacroMap trips={tripsWithDestinations} />
        </div>

        {trips.length === 0 ? (
          <div className="text-center py-16">
            <Plane className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-600 mb-2">No trips yet</h2>
            <p className="text-gray-500 mb-6">Create your first trip to get started!</p>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {trips.map((trip) => (
              <div key={trip.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-lg transition-all duration-300 group">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-indigo-50 rounded-xl group-hover:bg-indigo-100 transition-colors">
                    <MapPin className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-medium text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">{formatTripDate(trip)}</span>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        setEditingTrip(trip);
                        setShowTripModal(true);
                      }}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Edit trip"
                    >
                      <Pencil className="w-4 h-4 text-gray-500" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        handleDeleteClick(trip);
                      }}
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete trip"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">{getTripTitle(trip)}</h3>
                <p className="text-gray-500 text-sm mb-6 leading-relaxed">{getTripDescription(trip)}</p>
                <Link
                  to={`/trips/${trip.id}`}
                  className="inline-flex items-center text-indigo-600 font-semibold hover:text-indigo-700 transition-colors"
                >
                  View Itinerary <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            ))}
          </div>
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
