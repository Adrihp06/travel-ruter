import React from 'react';
import { useTranslation } from 'react-i18next';
import { Car, Train, Bus, Footprints, Bike, Ship } from 'lucide-react';
import AirplaneIcon from '@/components/icons/airplane-icon';

const TRAVEL_MODES = [
  { id: 'plane', labelKey: 'trips.travelModes.plane', Icon: AirplaneIcon },
  { id: 'car', labelKey: 'trips.travelModes.car', Icon: Car },
  { id: 'train', labelKey: 'trips.travelModes.train', Icon: Train },
  { id: 'bus', labelKey: 'trips.travelModes.bus', Icon: Bus },
  { id: 'walk', labelKey: 'trips.travelModes.walk', Icon: Footprints },
  { id: 'bike', labelKey: 'trips.travelModes.bike', Icon: Bike },
  { id: 'ferry', labelKey: 'trips.travelModes.ferry', Icon: Ship },
];

const TravelModeSelector = ({
  selectedMode,
  onSelectMode,
  disabled = false,
  compact = false,
}) => {
  const { t } = useTranslation();

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {TRAVEL_MODES.map(({ id, labelKey, Icon }) => (
          <button
            key={id}
            onClick={() => onSelectMode(id)}
            disabled={disabled}
            title={t(labelKey)}
            className={`
              p-1.5 rounded transition-all
              ${selectedMode === id
                ? 'bg-amber-100 dark:bg-amber-900/30 text-[#D97706] dark:text-amber-400'
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
      {TRAVEL_MODES.map(({ id, labelKey, Icon }) => (
        <button
          key={id}
          onClick={() => onSelectMode(id)}
          disabled={disabled}
          className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all
            ${selectedMode === id
              ? 'bg-[#D97706] text-white shadow-sm'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          <Icon className="w-4 h-4" />
          <span>{t(labelKey)}</span>
        </button>
      ))}
    </div>
  );
};

export default TravelModeSelector;
export { TRAVEL_MODES };
