import React, { useState, useEffect } from 'react';
import { MapPin, Clock, Plus, Trash2, GripVertical, Pencil, ChevronDown, ChevronUp } from 'lucide-react';
import useTravelStopStore from '../../stores/useTravelStopStore';

const formatDuration = (minutes) => {
  if (!minutes) return '--';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
};

const TravelStopItem = ({ stop, onEdit, onDelete }) => {
  return (
    <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700/50 group">
      <div className="flex-shrink-0 cursor-move text-amber-400 dark:text-amber-500">
        <GripVertical className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 flex-shrink-0" />
          <span className="font-medium text-sm text-gray-800 dark:text-gray-200 truncate">
            {stop.name}
          </span>
        </div>
        {stop.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5 pl-5">
            {stop.description}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded-full">
        <Clock className="w-3 h-3" />
        <span>{formatDuration(stop.duration_minutes)}</span>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(stop)}
          className="p-1 text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
          title="Edit stop"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onDelete(stop.id)}
          className="p-1 text-gray-400 hover:text-red-500 transition-colors"
          title="Delete stop"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

const TravelStopsList = ({ segmentId, onAddStop, onStopChanged }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { getStopsForSegment, fetchStopsForSegment, deleteStop, isLoading } = useTravelStopStore();

  const stops = getStopsForSegment(segmentId);

  useEffect(() => {
    if (segmentId) {
      fetchStopsForSegment(segmentId);
    }
  }, [segmentId, fetchStopsForSegment]);

  const handleDelete = async (stopId) => {
    if (window.confirm('Are you sure you want to delete this stop?')) {
      await deleteStop(stopId, segmentId);
      // Notify parent that a stop was deleted (to refetch segment for updated route)
      if (onStopChanged) {
        onStopChanged();
      }
    }
  };

  const handleEdit = (stop) => {
    if (onAddStop) {
      onAddStop(stop);
    }
  };

  // Compact button when no stops
  if (stops.length === 0) {
    return (
      <button
        onClick={() => onAddStop && onAddStop()}
        className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors px-2 py-1 rounded hover:bg-amber-50 dark:hover:bg-amber-900/20"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Add stop</span>
      </button>
    );
  }

  // Collapsed view showing stop count
  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded px-2 py-1.5 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
      >
        <MapPin className="w-3.5 h-3.5" />
        <span>{stops.length} stop{stops.length > 1 ? 's' : ''}</span>
        <ChevronDown className="w-3 h-3 ml-1" />
      </button>
    );
  }

  // Expanded view showing all stops
  return (
    <div className="space-y-2 mt-2">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(false)}
          className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
        >
          <MapPin className="w-3.5 h-3.5 text-amber-500" />
          <span>{stops.length} intermediate stop{stops.length > 1 ? 's' : ''}</span>
          <ChevronUp className="w-3 h-3 ml-1" />
        </button>
        <button
          onClick={() => onAddStop && onAddStop()}
          className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add</span>
        </button>
      </div>

      <div className="space-y-1.5 pl-1">
        {isLoading ? (
          <div className="text-xs text-gray-400 py-2">Loading stops...</div>
        ) : (
          stops.map((stop) => (
            <TravelStopItem
              key={stop.id}
              stop={stop}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default TravelStopsList;
