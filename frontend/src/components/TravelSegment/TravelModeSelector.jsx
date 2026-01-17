import React from 'react';
import { Plane, Car, Train, Bus, Footprints, Bike, Ship } from 'lucide-react';

const TRAVEL_MODES = [
  { id: 'plane', label: 'Plane', Icon: Plane },
  { id: 'car', label: 'Car', Icon: Car },
  { id: 'train', label: 'Train', Icon: Train },
  { id: 'bus', label: 'Bus', Icon: Bus },
  { id: 'walk', label: 'Walk', Icon: Footprints },
  { id: 'bike', label: 'Bike', Icon: Bike },
  { id: 'ferry', label: 'Ferry', Icon: Ship },
];

const TravelModeSelector = ({
  selectedMode,
  onSelectMode,
  disabled = false,
  compact = false,
}) => {
  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {TRAVEL_MODES.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => onSelectMode(id)}
            disabled={disabled}
            title={label}
            className={`
              p-1.5 rounded transition-all
              ${selectedMode === id
                ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400'
                : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <Icon className="w-3.5 h-3.5" />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {TRAVEL_MODES.map(({ id, label, Icon }) => (
        <button
          key={id}
          onClick={() => onSelectMode(id)}
          disabled={disabled}
          className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all
            ${selectedMode === id
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          <Icon className="w-4 h-4" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
};

export default TravelModeSelector;
export { TRAVEL_MODES };
