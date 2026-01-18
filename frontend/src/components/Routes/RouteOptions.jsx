import React from 'react';
import { Car, Footprints, Bike, Train, Plane, Navigation } from 'lucide-react';

// Transport mode configurations
const TRANSPORT_MODES = [
  { id: 'driving', label: 'Drive', icon: Car, color: 'indigo' },
  { id: 'walking', label: 'Walk', icon: Footprints, color: 'green' },
  { id: 'cycling', label: 'Bike', icon: Bike, color: 'amber' },
  { id: 'train', label: 'Train', icon: Train, color: 'purple' },
  { id: 'flight', label: 'Fly', icon: Plane, color: 'blue' },
];

// Inter-city modes (for longer distances)
const INTER_CITY_MODES = ['driving', 'train', 'flight'];

// Intra-city modes (for shorter distances within a city)
const INTRA_CITY_MODES = ['driving', 'walking', 'cycling'];

/**
 * RouteOptions component - Transport mode selector
 *
 * @param {Object} props
 * @param {string} props.selectedMode - Currently selected transport mode
 * @param {Function} props.onModeChange - Callback when mode changes
 * @param {boolean} props.isInterCity - Show inter-city modes (default: false shows intra-city)
 * @param {boolean} props.showLabels - Show text labels (default: true)
 * @param {boolean} props.disabled - Disable all options
 * @param {string} props.size - Size variant ('sm', 'md', 'lg')
 */
const RouteOptions = ({
  selectedMode = 'driving',
  onModeChange,
  isInterCity = false,
  showLabels = true,
  disabled = false,
  size = 'md',
}) => {
  // Filter modes based on inter-city or intra-city
  const availableModes = TRANSPORT_MODES.filter(mode =>
    isInterCity ? INTER_CITY_MODES.includes(mode.id) : INTRA_CITY_MODES.includes(mode.id)
  );

  // Size classes
  const sizeClasses = {
    sm: {
      button: 'px-2 py-1.5',
      icon: 'w-4 h-4',
      text: 'text-xs',
      gap: 'gap-1',
    },
    md: {
      button: 'px-3 py-2',
      icon: 'w-5 h-5',
      text: 'text-sm',
      gap: 'gap-1.5',
    },
    lg: {
      button: 'px-4 py-2.5',
      icon: 'w-6 h-6',
      text: 'text-base',
      gap: 'gap-2',
    },
  };

  const sizes = sizeClasses[size] || sizeClasses.md;

  return (
    <div className="flex items-center gap-1">
      {availableModes.map((mode) => {
        const Icon = mode.icon;
        const isSelected = selectedMode === mode.id;

        return (
          <button
            key={mode.id}
            onClick={() => onModeChange?.(mode.id)}
            disabled={disabled}
            className={`
              flex items-center ${sizes.gap} ${sizes.button}
              rounded-lg font-medium transition-all duration-200
              ${isSelected
                ? `bg-${mode.color}-100 text-${mode.color}-700 border-2 border-${mode.color}-500`
                : 'bg-gray-50 text-gray-600 border-2 border-transparent hover:bg-gray-100'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
            title={mode.label}
          >
            <Icon className={`${sizes.icon} ${isSelected ? `text-${mode.color}-600` : 'text-gray-500'}`} />
            {showLabels && <span className={sizes.text}>{mode.label}</span>}
          </button>
        );
      })}
    </div>
  );
};

/**
 * RouteOptionsCompact - A more compact inline version for tight spaces
 */
export const RouteOptionsCompact = ({
  selectedMode = 'driving',
  onModeChange,
  isInterCity = false,
  disabled = false,
}) => {
  const availableModes = TRANSPORT_MODES.filter(mode =>
    isInterCity ? INTER_CITY_MODES.includes(mode.id) : INTRA_CITY_MODES.includes(mode.id)
  );

  return (
    <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
      {availableModes.map((mode, index) => {
        const Icon = mode.icon;
        const isSelected = selectedMode === mode.id;

        return (
          <button
            key={mode.id}
            onClick={() => onModeChange?.(mode.id)}
            disabled={disabled}
            className={`
              p-2 transition-colors duration-150
              ${index !== 0 ? 'border-l border-gray-200' : ''}
              ${isSelected
                ? 'bg-indigo-50 text-indigo-600'
                : 'bg-white text-gray-500 hover:bg-gray-50'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
            title={mode.label}
          >
            <Icon className="w-4 h-4" />
          </button>
        );
      })}
    </div>
  );
};

/**
 * RouteOptionsDropdown - Dropdown variant for minimal space
 */
export const RouteOptionsDropdown = ({
  selectedMode = 'driving',
  onModeChange,
  isInterCity = false,
  disabled = false,
}) => {
  const availableModes = TRANSPORT_MODES.filter(mode =>
    isInterCity ? INTER_CITY_MODES.includes(mode.id) : INTRA_CITY_MODES.includes(mode.id)
  );

  const selectedModeConfig = availableModes.find(m => m.id === selectedMode) || availableModes[0];
  const SelectedIcon = selectedModeConfig?.icon || Car;

  return (
    <div className="relative">
      <select
        value={selectedMode}
        onChange={(e) => onModeChange?.(e.target.value)}
        disabled={disabled}
        className={`
          appearance-none pl-9 pr-8 py-2 rounded-lg border border-gray-200
          bg-white text-sm font-medium text-gray-700
          focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        {availableModes.map((mode) => (
          <option key={mode.id} value={mode.id}>
            {mode.label}
          </option>
        ))}
      </select>
      <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
        <SelectedIcon className="w-4 h-4 text-gray-500" />
      </div>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
        <Navigation className="w-3 h-3 text-gray-400" />
      </div>
    </div>
  );
};

export default RouteOptions;
