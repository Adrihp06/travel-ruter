import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Calendar, Moon, Pencil, Trash2 } from 'lucide-react';

const SortableDestinationItem = ({
  destination,
  isSelected,
  nights,
  onSelect,
  onEdit,
  onDelete,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: destination.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group"
    >
      {/* Destination Node */}
      <div
        onClick={() => onSelect(destination.id)}
        className={`
          relative pl-6 py-3 pr-2 cursor-pointer transition-all duration-200
          ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/30 rounded-lg' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}
          ${isDragging ? 'shadow-lg rounded-lg bg-white dark:bg-gray-800' : ''}
        `}
      >
        {/* Node marker */}
        <span className={`
          absolute left-0 top-4 w-3 h-3 rounded-full border-2 z-10
          ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-white dark:bg-gray-800 border-indigo-400'}
        `}></span>

        <div className="flex items-start justify-between">
          {/* Drag Handle */}
          <div
            {...attributes}
            {...listeners}
            className="flex items-center justify-center w-5 h-full mr-1 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity touch-none"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-4 h-4 text-gray-400 dark:text-gray-500" />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className={`font-medium ${isSelected ? 'text-indigo-900 dark:text-indigo-300' : 'text-gray-900 dark:text-white'}`}>
              {destination.name || destination.city_name}
            </h3>
            <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mt-1">
              <Calendar className="w-3 h-3 mr-1" />
              <span>{new Date(destination.arrival_date).toLocaleDateString()}</span>
              <span className="mx-1">-</span>
              <span>{new Date(destination.departure_date).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center text-xs font-medium text-indigo-600 dark:text-indigo-400 mt-1">
              <Moon className="w-3 h-3 mr-1" />
              {nights} nights
            </div>
          </div>

          {/* Edit/Delete buttons */}
          {(onEdit || onDelete) && (
            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
              {onEdit && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(destination);
                  }}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                  title="Edit destination"
                >
                  <Pencil className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(destination.id);
                  }}
                  className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                  title="Delete destination"
                >
                  <Trash2 className="w-3 h-3 text-red-500 dark:text-red-400" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SortableDestinationItem;
