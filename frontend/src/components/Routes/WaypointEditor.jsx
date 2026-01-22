import React, { useEffect, useState } from 'react';
import {
  MapPin,
  GripVertical,
  Trash2,
  Plus,
  Loader2,
  X,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import useWaypointStore from '../../stores/useWaypointStore';

const WaypointItem = ({
  waypoint,
  index,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  isLoading,
}) => {
  return (
    <div className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 group">
      <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
            #{index + 1}
          </span>
          {waypoint.name ? (
            <span className="text-sm text-gray-700 dark:text-gray-200 truncate">
              {waypoint.name}
            </span>
          ) : (
            <span className="text-sm text-gray-400 dark:text-gray-500">
              {waypoint.latitude.toFixed(4)}, {waypoint.longitude.toFixed(4)}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onMoveUp(waypoint.id)}
          disabled={isFirst || isLoading}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Move up"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
        <button
          onClick={() => onMoveDown(waypoint.id)}
          disabled={isLast || isLoading}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Move down"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDelete(waypoint.id)}
          disabled={isLoading}
          className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Delete waypoint"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

const WaypointEditor = ({
  segmentId,
  fromCity,
  toCity,
  onClose,
  onAddWaypointClick,
  isAddingWaypoint,
}) => {
  const {
    getWaypoints,
    fetchSegmentWaypoints,
    deleteWaypoint,
    reorderWaypoints,
    isSegmentLoading,
    enterAddWaypointMode,
    exitAddWaypointMode,
    error,
  } = useWaypointStore();

  const waypoints = getWaypoints(segmentId);
  const isLoading = isSegmentLoading(segmentId);
  const [localError, setLocalError] = useState(null);

  // Fetch waypoints when component mounts
  useEffect(() => {
    fetchSegmentWaypoints(segmentId).catch((err) => {
      setLocalError(err.message);
    });
  }, [segmentId, fetchSegmentWaypoints]);

  const handleDelete = async (waypointId) => {
    try {
      setLocalError(null);
      await deleteWaypoint(waypointId, segmentId);
    } catch (err) {
      setLocalError(err.message);
    }
  };

  const handleMoveUp = async (waypointId) => {
    const idx = waypoints.findIndex((wp) => wp.id === waypointId);
    if (idx <= 0) return;

    // Swap order indices
    const newOrders = waypoints.map((wp, i) => {
      if (i === idx) return { id: wp.id, order_index: i - 1 };
      if (i === idx - 1) return { id: wp.id, order_index: i + 1 };
      return { id: wp.id, order_index: i };
    });

    try {
      setLocalError(null);
      await reorderWaypoints(segmentId, newOrders);
    } catch (err) {
      setLocalError(err.message);
    }
  };

  const handleMoveDown = async (waypointId) => {
    const idx = waypoints.findIndex((wp) => wp.id === waypointId);
    if (idx >= waypoints.length - 1) return;

    // Swap order indices
    const newOrders = waypoints.map((wp, i) => {
      if (i === idx) return { id: wp.id, order_index: i + 1 };
      if (i === idx + 1) return { id: wp.id, order_index: i - 1 };
      return { id: wp.id, order_index: i };
    });

    try {
      setLocalError(null);
      await reorderWaypoints(segmentId, newOrders);
    } catch (err) {
      setLocalError(err.message);
    }
  };

  const handleAddClick = () => {
    if (isAddingWaypoint) {
      exitAddWaypointMode();
    } else {
      enterAddWaypointMode(segmentId);
      if (onAddWaypointClick) {
        onAddWaypointClick();
      }
    }
  };

  const displayError = localError || error;

  return (
    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
            Route Waypoints
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            ({fromCity} → {toCity})
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Error display */}
      {displayError && (
        <div className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">
          {displayError}
        </div>
      )}

      {/* Waypoints list */}
      {isLoading && waypoints.length === 0 ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      ) : waypoints.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
          No waypoints added. Click on the map or use the button below to add
          waypoints.
        </p>
      ) : (
        <div className="space-y-2">
          {waypoints.map((waypoint, idx) => (
            <WaypointItem
              key={waypoint.id}
              waypoint={waypoint}
              index={idx}
              onDelete={handleDelete}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              isFirst={idx === 0}
              isLast={idx === waypoints.length - 1}
              isLoading={isLoading}
            />
          ))}
        </div>
      )}

      {/* Add waypoint button */}
      <button
        onClick={handleAddClick}
        disabled={isLoading}
        className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-sm rounded border-2 border-dashed transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          isAddingWaypoint
            ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
            : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-500'
        }`}
      >
        {isAddingWaypoint ? (
          <>
            <X className="w-4 h-4" />
            <span>Cancel (click map to add waypoint)</span>
          </>
        ) : (
          <>
            <Plus className="w-4 h-4" />
            <span>Add waypoint (click on map)</span>
          </>
        )}
      </button>
    </div>
  );
};

export default WaypointEditor;
