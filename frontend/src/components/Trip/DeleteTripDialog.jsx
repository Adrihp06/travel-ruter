import React from 'react';
import { X, Trash2, AlertTriangle, MapPin, Calendar } from 'lucide-react';

const DeleteTripDialog = ({ isOpen, onClose, trip, onConfirm, isDeleting }) => {
  if (!isOpen || !trip) return null;

  const tripName = trip.title || trip.name || 'Untitled Trip';
  const destinationCount = trip.destinations?.length || 0;

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleConfirm = () => {
    onConfirm();
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-red-100 rounded-lg">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Delete Trip</h3>
          </div>
          <button
            onClick={handleClose}
            disabled={isDeleting}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Warning */}
          <div className="flex items-start space-x-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium">This action can be undone</p>
              <p className="mt-1">You will have 5 seconds to undo the deletion after confirming.</p>
            </div>
          </div>

          {/* Trip Info */}
          <div className="p-4 bg-gray-50 rounded-lg space-y-3">
            <h4 className="font-semibold text-gray-900 text-lg">{tripName}</h4>

            {trip.start_date && (
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Calendar className="w-4 h-4" />
                <span>
                  {formatDate(trip.start_date)}
                  {trip.end_date && ` - ${formatDate(trip.end_date)}`}
                </span>
              </div>
            )}

            {destinationCount > 0 && (
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <MapPin className="w-4 h-4" />
                <span>
                  {destinationCount} destination{destinationCount !== 1 ? 's' : ''} will be deleted
                </span>
              </div>
            )}

            {trip.description && (
              <p className="text-sm text-gray-500 line-clamp-2">{trip.description}</p>
            )}
          </div>

          {/* Confirmation Text */}
          <p className="text-sm text-gray-600">
            Are you sure you want to delete this trip? All associated destinations and their data will be permanently removed.
          </p>
        </div>

        {/* Buttons */}
        <div className="flex space-x-3 p-4 border-t border-gray-200">
          <button
            type="button"
            onClick={handleClose}
            disabled={isDeleting}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isDeleting}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center space-x-2"
          >
            {isDeleting ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Delete Trip</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteTripDialog;
