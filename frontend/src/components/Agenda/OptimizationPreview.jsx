import React, { useMemo } from 'react';
import {
  X,
  Check,
  Route,
  Clock,
  MapPin,
  AlertTriangle,
  Footprints,
} from 'lucide-react';

const OptimizationPreview = ({
  isOpen,
  onClose,
  onApply,
  optimizationResult,
  isApplying,
  dayNumber,
  startLocationName,
  startTime,
  onStartTimeChange,
}) => {
  // Check if order changed
  const orderChanged = useMemo(() => {
    const optimized_order = optimizationResult?.optimized_order || [];
    const original_order = optimizationResult?.original_order || [];
    if (original_order.length !== optimized_order.length) return true;
    return original_order.some((id, idx) => id !== optimized_order[idx]);
  }, [optimizationResult?.optimized_order, optimizationResult?.original_order]);

  // Format duration
  const formatDuration = (minutes) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Early return after hooks
  if (!isOpen || !optimizationResult) return null;

  // Extract values for rendering
  const { original_order, total_distance_km, total_duration_minutes, schedule } = optimizationResult;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop bg-black/40 p-4">
      <div className="modal-content bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
        {/* Header */}
        <div className="modal-header flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="modal-icon-container primary">
              <Route className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Optimized Route
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Day {dayNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="modal-close-btn p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50/50 dark:from-indigo-900/30 dark:to-blue-900/20 rounded-xl p-4 border border-indigo-100/70 dark:border-indigo-800/40">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-2">
                <Footprints className="w-4 h-4" />
                <span className="text-xs font-medium uppercase tracking-wide">Total Distance</span>
              </div>
              <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">
                {total_distance_km.toFixed(1)} <span className="text-sm font-medium">km</span>
              </p>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-green-50/50 dark:from-emerald-900/30 dark:to-green-900/20 rounded-xl p-4 border border-emerald-100/70 dark:border-emerald-800/40">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-2">
                <Clock className="w-4 h-4" />
                <span className="text-xs font-medium uppercase tracking-wide">Travel Time</span>
              </div>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                {formatDuration(total_duration_minutes)}
              </p>
            </div>
          </div>

          {/* Order Change Notice */}
          {!orderChanged && (
            <div className="flex items-center gap-3 p-4 bg-gradient-to-br from-amber-50 to-yellow-50/50 dark:from-yellow-900/20 dark:to-amber-900/10 rounded-xl border border-amber-200/70 dark:border-yellow-800/40">
              <div className="modal-icon-container warning w-9 h-9 rounded-lg flex-shrink-0">
                <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
              </div>
              <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
                The current order is already optimal!
              </p>
            </div>
          )}

          {/* Start Time & Location */}
          <div className="flex items-center justify-between gap-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50/50 dark:from-green-900/20 dark:to-emerald-900/10 rounded-xl border border-green-200/70 dark:border-green-800/40">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <div className="w-7 h-7 bg-green-100 dark:bg-green-900/40 rounded-lg flex items-center justify-center">
                <MapPin className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>
              <span className="truncate">
                Start: <span className="font-semibold text-gray-900 dark:text-white">{startLocationName || 'Accommodation'}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <input
                type="time"
                value={startTime}
                onChange={(e) => onStartTimeChange?.(e.target.value)}
                className="modal-input px-3 py-1.5 text-sm rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {/* Schedule with Times */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Optimized schedule
            </p>
            <div className="space-y-2">
              {(schedule || []).map((item, index) => {
                const originalIndex = original_order.indexOf(item.id);
                const positionChange = originalIndex - index;

                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/40 rounded-xl border border-gray-100 dark:border-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors"
                  >
                    {/* Time column */}
                    <div className="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400 w-24 text-right font-mono">
                      <span className="font-semibold text-gray-700 dark:text-gray-300">{item.estimated_arrival}</span>
                      <span className="mx-1 opacity-50">-</span>
                      <span className="opacity-70">{item.estimated_departure}</span>
                    </div>
                    {/* Order badge */}
                    <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center bg-gradient-to-br from-indigo-100 to-blue-100 dark:from-indigo-900/50 dark:to-blue-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-bold shadow-sm">
                      {index + 1}
                    </div>
                    {/* POI info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {item.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {item.category}
                        {item.dwell_time && <span className="opacity-60"> • {item.dwell_time} min</span>}
                      </p>
                    </div>
                    {/* Position change badge */}
                    {positionChange !== 0 && (
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-semibold ${
                          positionChange > 0
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                            : 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400'
                        }`}
                      >
                        {positionChange > 0 ? `+${positionChange}` : positionChange}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
          <button
            onClick={onClose}
            disabled={isApplying}
            className="modal-btn modal-btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={onApply}
            disabled={isApplying || !orderChanged}
            className="modal-btn modal-btn-primary"
          >
            {isApplying ? (
              <>
                <span className="modal-spinner" />
                <span>Applying...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Apply Order</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OptimizationPreview;
