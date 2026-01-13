import React from 'react';
import { Sun, Cloud, Snowflake, Thermometer } from 'lucide-react';

/**
 * Get weather icon based on temperature
 */
const getWeatherIcon = (temperature) => {
  if (temperature === null || temperature === undefined) {
    return <Thermometer className="w-5 h-5 text-gray-400" />;
  }
  if (temperature >= 25) {
    return <Sun className="w-5 h-5 text-yellow-500" />;
  }
  if (temperature >= 10) {
    return <Cloud className="w-5 h-5 text-blue-400" />;
  }
  return <Snowflake className="w-5 h-5 text-blue-200" />;
};

/**
 * WeatherDisplay component
 * Shows weather icon and temperature for a destination
 */
const WeatherDisplay = ({ weather, isLoading, error, compact = false }) => {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-gray-400">
        <Thermometer className="w-5 h-5 animate-pulse" />
        <span className="text-sm">Loading weather...</span>
      </div>
    );
  }

  if (error) {
    return null; // Silently hide if weather data is unavailable
  }

  if (!weather || weather.average_temperature === null) {
    return null;
  }

  const icon = getWeatherIcon(weather.average_temperature);

  if (compact) {
    return (
      <div className="flex items-center gap-1.5" title={weather.display_text}>
        {icon}
        <span className="text-sm font-medium text-gray-700">
          {weather.average_temperature}°C
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg">
      {icon}
      <div className="flex flex-col">
        <span className="text-sm font-medium text-gray-800">
          {weather.display_text}
        </span>
        <span className="text-xs text-gray-500">
          Historical average
        </span>
      </div>
    </div>
  );
};

export default WeatherDisplay;
