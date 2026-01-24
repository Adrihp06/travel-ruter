import React from 'react';
import { X, Trash2, AlertTriangle, MapPin, Calendar } from 'lucide-react';
import { formatDateFull } from '../../utils/dateFormat';

const DeleteTripDialog = ({ isOpen, onClose, trip, onConfirm, isDeleting }) => {
  if (!isOpen || !trip) return null;

  const tripName = trip.title || trip.name || 'Untitled Trip';
  const destinationCount = trip.destinations?.length || 0;

  const handleConfirm = () => {
    onConfirm();
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-scale-fade border border-stone-200/50 dark:border-stone-700">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-stone-200 dark:border-stone-700">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-red-100 dark:bg-red-900/30 rounded-xl">
              <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-bold text-stone-900 dark:text-stone-50">Delete Trip</h3>
          </div>
          <button
            onClick={handleClose}
            disabled={isDeleting}
            className="p-2 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-xl transition-all disabled:opacity-50"
          >
            <X className="w-5 h-5 text-stone-500 dark:text-stone-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Warning */}
          <div className="flex items-start space-x-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800 dark:text-amber-300">
              <p className="font-semibold">This action can be undone</p>
              <p className="mt-1 opacity-90">You will have 5 seconds to undo the deletion after confirming.</p>
            </div>
          </div>

          {/* Trip Info */}
          <div className="p-4 bg-stone-50 dark:bg-stone-700/50 rounded-xl space-y-3 border border-stone-100 dark:border-stone-600/30">
            <h4 className="font-bold text-stone-900 dark:text-stone-50 text-lg">{tripName}</h4>

            {trip.start_date && (
              <div className="flex items-center space-x-2 text-sm text-stone-600 dark:text-stone-300">
                <Calendar className="w-4 h-4 text-stone-400" />
                <span>
                  {formatDateFull(trip.start_date)}
                  {trip.end_date && ` - ${formatDateFull(trip.end_date)}`}
                </span>
              </div>
            )}

            {destinationCount > 0 && (
              <div className="flex items-center space-x-2 text-sm text-stone-600 dark:text-stone-300">
                <MapPin className="w-4 h-4 text-stone-400" />
                <span>
                  {destinationCount} destination{destinationCount !== 1 ? 's' : ''} will be deleted
                </span>
              </div>
            )}

            {trip.description && (
              <p className="text-sm text-stone-500 dark:text-stone-400 line-clamp-2">{trip.description}</p>
            )}
          </div>

          {/* Confirmation Text */}
          <p className="text-sm text-stone-600 dark:text-stone-300">
            Are you sure you want to delete this trip? All associated destinations and their data will be permanently removed.
          </p>
        </div>

        {/* Buttons */}
        <div className="flex space-x-3 p-5 border-t border-stone-200 dark:border-stone-700">
          <button
            type="button"
            onClick={handleClose}
            disabled={isDeleting}
            className="flex-1 px-4 py-2.5 border border-stone-300 dark:border-stone-600 text-stone-700 dark:text-stone-300 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-700 disabled:opacity-50 transition-all font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isDeleting}
            className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 transition-all flex items-center justify-center space-x-2 font-medium shadow-sm hover:shadow-md press-effect"
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
