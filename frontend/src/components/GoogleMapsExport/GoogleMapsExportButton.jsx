import React, { useState } from 'react';
import { ExternalLink, Map, ChevronDown } from 'lucide-react';
import {
  generateGoogleMapsUrlFromDestinations,
  openGoogleMapsUrl,
  GoogleMapsTravelMode,
} from '../../utils/googleMaps';

const travelModeOptions = [
  { value: GoogleMapsTravelMode.DRIVING, label: 'Driving' },
  { value: GoogleMapsTravelMode.TRANSIT, label: 'Transit' },
  { value: GoogleMapsTravelMode.WALKING, label: 'Walking' },
  { value: GoogleMapsTravelMode.BICYCLING, label: 'Bicycling' },
];

const GoogleMapsExportButton = ({ destinations, className = '' }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState(GoogleMapsTravelMode.DRIVING);
  const [error, setError] = useState(null);

  const handleExport = (mode = selectedMode) => {
    try {
      setError(null);
      const url = generateGoogleMapsUrlFromDestinations(destinations, mode);
      openGoogleMapsUrl(url);
      setIsDropdownOpen(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleModeSelect = (mode) => {
    setSelectedMode(mode);
    handleExport(mode);
  };

  const isDisabled = !destinations || destinations.length < 2;
  const currentModeLabel = travelModeOptions.find((opt) => opt.value === selectedMode)?.label || 'Driving';

  return (
    <div className={`relative inline-block ${className}`}>
      <div className="flex">
        <button
          onClick={() => handleExport()}
          disabled={isDisabled}
          className={`flex items-center gap-2 px-4 py-2 rounded-l-lg font-medium transition-colors ${
            isDisabled
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
          title={isDisabled ? 'Need at least 2 destinations to export' : `Export to Google Maps (${currentModeLabel})`}
        >
          <Map className="w-4 h-4" />
          <span>Export to Google Maps</span>
          <ExternalLink className="w-3 h-3" />
        </button>

        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          disabled={isDisabled}
          className={`px-2 py-2 rounded-r-lg border-l transition-colors ${
            isDisabled
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200'
              : 'bg-blue-600 text-white hover:bg-blue-700 border-blue-500'
          }`}
          aria-label="Select travel mode"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {isDropdownOpen && !isDisabled && (
        <div className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
          <div className="py-1">
            {travelModeOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handleModeSelect(option.value)}
                className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 transition-colors ${
                  selectedMode === option.value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <div className="absolute top-full left-0 mt-1 text-xs text-red-600">{error}</div>}
    </div>
  );
};

export default GoogleMapsExportButton;
