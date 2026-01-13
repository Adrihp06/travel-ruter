import React from 'react';
import { Calendar, Moon } from 'lucide-react';

const Timeline = ({ destinations, onSelectDestination, selectedDestinationId }) => {
  const calculateNights = (start, end) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    return diffDays;
  };

  // Sort destinations chronologically
  const sortedDestinations = [...destinations].sort((a, b) => new Date(a.arrivalDate) - new Date(b.arrivalDate));

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200 w-80 overflow-y-auto">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Itinerary</h2>
      </div>
      <div className="flex-1 p-2 space-y-2">
        {sortedDestinations.map((dest) => {
          const isSelected = selectedDestinationId === dest.id;
          const nights = calculateNights(dest.arrivalDate, dest.departureDate);
          
          return (
            <div
              key={dest.id}
              onClick={() => onSelectDestination(dest.id)}
              className={`
                group relative p-3 rounded-lg cursor-pointer transition-all duration-200 border
                ${isSelected 
                  ? 'bg-indigo-50 border-indigo-200 shadow-sm' 
                  : 'bg-white border-transparent hover:bg-gray-50 hover:border-gray-200'}
              `}
            >
              <div className="flex justify-between items-start mb-1">
                <h3 className={`font-medium ${isSelected ? 'text-indigo-900' : 'text-gray-900'}`}>
                  {dest.name}
                </h3>
              </div>
              
              <div className="flex items-center text-xs text-gray-500 mb-2 space-x-2">
                <div className="flex items-center">
                  <Calendar className="w-3 h-3 mr-1" />
                  <span>{new Date(dest.arrivalDate).toLocaleDateString()}</span>
                </div>
                <span>→</span>
                <div>
                   <span>{new Date(dest.departureDate).toLocaleDateString()}</span>
                </div>
              </div>
              
              <div className="flex items-center text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded w-fit">
                <Moon className="w-3 h-3 mr-1" />
                {nights} nights
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Timeline;
