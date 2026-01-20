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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Route className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Optimized Route for Day {dayNumber}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-indigo-50 dark:bg-indigo-900/30 rounded-lg p-3">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-1">
                <Footprints className="w-4 h-4" />
                <span className="text-sm font-medium">Total Distance</span>
              </div>
              <p className="text-xl font-bold text-indigo-700 dark:text-indigo-300">
                {total_distance_km.toFixed(1)} km
              </p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/30 rounded-lg p-3">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">Travel Time</span>
              </div>
              <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                {formatDuration(total_duration_minutes)}
              </p>
            </div>
          </div>

          {/* Order Change Notice */}
          {!orderChanged && (
            <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                The current order is already optimal!
              </p>
            </div>
          )}

          {/* Start Time & Location */}
          <div className="flex items-center justify-between gap-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <MapPin className="w-4 h-4 text-green-500 flex-shrink-0" />
              <span className="truncate">
                Start: <span className="font-medium text-gray-900 dark:text-white">{startLocationName || 'Accommodation'}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-500" />
              <input
                type="time"
                value={startTime}
                onChange={(e) => onStartTimeChange?.(e.target.value)}
                className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {/* Schedule with Times */}
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Optimized schedule:
            </p>
            <div className="space-y-2">
              {(schedule || []).map((item, index) => {
                const originalIndex = original_order.indexOf(item.id);
                const positionChange = originalIndex - index;

                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                  >
                    {/* Time column */}
                    <div className="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400 w-24 text-right">
                      <span className="font-medium text-gray-700 dark:text-gray-300">{item.estimated_arrival}</span>
                      <span className="mx-1">-</span>
                      <span>{item.estimated_departure}</span>
                    </div>
                    {/* Order badge */}
                    <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-bold">
                      {index + 1}
                    </div>
                    {/* POI info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {item.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {item.category}
                        {item.dwell_time && ` • ${item.dwell_time} min`}
                      </p>
                    </div>
                    {/* Position change badge */}
                    {positionChange !== 0 && (
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded ${
                          positionChange > 0
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
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
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <button
            onClick={onClose}
            disabled={isApplying}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onApply}
            disabled={isApplying || !orderChanged}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isApplying ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Applying...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Apply Order
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OptimizationPreview;
