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
    <div className="fixed inset-0 modal-backdrop bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="dialog-content bg-white dark:bg-stone-800 rounded-2xl shadow-2xl w-full max-w-md border border-stone-200/50 dark:border-stone-700/50">
        {/* Header */}
        <div className="modal-header flex items-center justify-between px-6 py-4 border-b border-stone-200 dark:border-stone-700">
          <div className="flex items-center gap-3">
            <div className="modal-icon-container danger">
              <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-bold text-stone-900 dark:text-stone-50">Delete Trip</h3>
          </div>
          <button
            onClick={handleClose}
            disabled={isDeleting}
            className="modal-close-btn p-2 rounded-xl text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-4">
          {/* Warning */}
          <div className="flex items-start gap-3 p-4 bg-gradient-to-br from-amber-50 to-orange-50/50 dark:from-amber-900/20 dark:to-orange-900/10 border border-amber-200/70 dark:border-amber-800/40 rounded-xl">
            <div className="modal-icon-container warning w-9 h-9 rounded-lg flex-shrink-0">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="text-sm">
              <p className="font-semibold text-amber-800 dark:text-amber-300">This action can be undone</p>
              <p className="mt-1 text-amber-700/80 dark:text-amber-400/70">You will have 5 seconds to undo the deletion after confirming.</p>
            </div>
          </div>

          {/* Trip Info */}
          <div className="p-4 bg-gradient-to-br from-stone-50 to-gray-50 dark:from-stone-700/50 dark:to-gray-800/30 rounded-xl space-y-3 border border-stone-100 dark:border-stone-600/30">
            <h4 className="font-bold text-stone-900 dark:text-stone-50 text-lg">{tripName}</h4>

            {trip.start_date && (
              <div className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
                <Calendar className="w-4 h-4 text-stone-400" />
                <span>
                  {formatDateFull(trip.start_date)}
                  {trip.end_date && ` - ${formatDateFull(trip.end_date)}`}
                </span>
              </div>
            )}

            {destinationCount > 0 && (
              <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                <MapPin className="w-4 h-4" />
                <span className="font-medium">
                  {destinationCount} destination{destinationCount !== 1 ? 's' : ''} will be deleted
                </span>
              </div>
            )}

            {trip.description && (
              <p className="text-sm text-stone-500 dark:text-stone-400 line-clamp-2 pt-1 border-t border-stone-200/50 dark:border-stone-600/30">{trip.description}</p>
            )}
          </div>

          {/* Confirmation Text */}
          <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
            Are you sure you want to delete this trip? All associated destinations and their data will be permanently removed.
          </p>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 px-6 py-4 border-t border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800/50">
          <button
            type="button"
            onClick={handleClose}
            disabled={isDeleting}
            className="modal-btn modal-btn-secondary flex-1"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isDeleting}
            className="modal-btn modal-btn-danger flex-1"
          >
            {isDeleting ? (
              <>
                <span className="modal-spinner" />
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
