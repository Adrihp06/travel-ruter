import React from 'react';
import { useTranslation } from 'react-i18next';
import { Car, Footprints, Bike, Train } from 'lucide-react';
import AirplaneIcon from '@/components/icons/airplane-icon';

// Transport mode configurations (labels resolved via i18n at render time)
const TRANSPORT_MODES = [
  { id: 'driving', labelKey: 'routes.modes.driving', icon: Car, color: 'green' },
  { id: 'walking', labelKey: 'routes.modes.walking', icon: Footprints, color: 'green' },
  { id: 'cycling', labelKey: 'routes.modes.cycling', icon: Bike, color: 'amber' },
  { id: 'train', labelKey: 'routes.modes.train', icon: Train, color: 'purple' },
  { id: 'flight', labelKey: 'routes.modes.flight', icon: AirplaneIcon, color: 'blue' },
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
  const { t } = useTranslation();

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
            title={t(mode.labelKey)}
          >
            <Icon className={`${sizes.icon} ${isSelected ? `text-${mode.color}-600` : 'text-gray-500'}`} />
            {showLabels && <span className={sizes.text}>{t(mode.labelKey)}</span>}
          </button>
        );
      })}
    </div>
  );
};

export default RouteOptions;
