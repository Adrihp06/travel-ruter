import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Clock, ThumbsUp, ThumbsDown } from 'lucide-react';
import useTripStore from '../stores/useTripStore';
import usePOIStore from '../stores/usePOIStore';
import Timeline from '../components/Timeline/Timeline';
import WeatherDisplay from '../components/Weather/WeatherDisplay';
import useDestinationWeather from '../hooks/useDestinationWeather';

const DestinationWeatherCard = ({ destination }) => {
  const { weather, isLoading, error } = useDestinationWeather(destination?.id);

  return (
    <WeatherDisplay
      weather={weather}
      isLoading={isLoading}
      error={error}
    />
  );
};

const DetailView = () => {
  const { id } = useParams();
  const { selectedTrip, fetchTripDetails, isLoading } = useTripStore();
  const { pois, fetchPOIsByDestination, votePOI } = usePOIStore();
  const [selectedDestinationId, setSelectedDestinationId] = useState(null);

  // Derive the selected destination object for the WeatherCard
  const selectedDestination = selectedTrip?.destinations?.find(d => d.id === selectedDestinationId);

  useEffect(() => {
    if (id) {
      fetchTripDetails(id);
    }
  }, [id, fetchTripDetails]);

  // Select first destination by default when trip loads
  useEffect(() => {
    if (selectedTrip?.destinations?.length > 0 && !selectedDestinationId) {
      setSelectedDestinationId(selectedTrip.destinations[0].id);
    }
  }, [selectedTrip, selectedDestinationId]);

  // Fetch POIs when destination selected
  useEffect(() => {
    if (selectedDestinationId) {
      fetchPOIsByDestination(selectedDestinationId);
    }
  }, [selectedDestinationId, fetchPOIsByDestination]);

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Loading itinerary...</div>;
  }

  if (!selectedTrip) {
    return <div className="p-8 text-center text-gray-500">Trip not found</div>;
  }

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Timeline Sidebar */}
      {selectedTrip.destinations && (
        <Timeline 
          destinations={selectedTrip.destinations}
          selectedDestinationId={selectedDestinationId}
          onSelectDestination={setSelectedDestinationId}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{selectedTrip.title} (Trip {id})</h1>
          <p className="text-gray-500">Detailed itinerary view.</p>
          
          {/* Weather Display from HEAD, integrated with our selection logic */}
          {selectedDestination && (
            <div className="mt-4">
              <DestinationWeatherCard destination={selectedDestination} />
            </div>
          )}
        </div>

        {/* POI Section */}
        {selectedDestinationId && pois.length > 0 && (
          <div className="mb-12 border-b border-gray-200 pb-8">
            <h2 className="text-xl font-semibold mb-6">Collaborative Planning</h2>
            <div className="space-y-8">
              {pois.map((categoryGroup) => (
                <div key={categoryGroup.category}>
                  <h3 className="text-lg font-medium text-gray-700 mb-4 flex items-center">
                    <span className="w-2 h-2 bg-indigo-500 rounded-full mr-2"></span>
                    {categoryGroup.category}
                  </h3>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {categoryGroup.pois.map((poi) => (
                      <div key={poi.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-semibold text-gray-900 text-lg">{poi.name}</h4>
                          <div className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            (poi.likes - poi.vetoes) > 5 ? 'bg-green-100 text-green-800' : 
                            (poi.likes - poi.vetoes) < 0 ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            Score: {poi.likes - poi.vetoes}
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 mb-4 line-clamp-2">{poi.description}</p>
                        
                        <div className="flex items-center justify-between mt-auto">
                          <div className="flex space-x-4">
                            <button 
                              onClick={() => votePOI(poi.id, 'like')}
                              className="group flex items-center space-x-1.5 text-gray-500 hover:text-green-600 transition-colors"
                              title="Like"
                            >
                              <div className="p-1.5 rounded-full group-hover:bg-green-50">
                                <ThumbsUp className="w-4 h-4" />
                              </div>
                              <span className="font-medium">{poi.likes}</span>
                            </button>
                            <button 
                              onClick={() => votePOI(poi.id, 'veto')}
                              className="group flex items-center space-x-1.5 text-gray-500 hover:text-red-600 transition-colors"
                              title="Veto"
                            >
                              <div className="p-1.5 rounded-full group-hover:bg-red-50">
                                <ThumbsDown className="w-4 h-4" />
                              </div>
                              <span className="font-medium">{poi.vetoes}</span>
                            </button>
                          </div>
                          {/* Visual indicator for highly liked items */}
                          {poi.likes > 10 && (
                            <span className="text-xs font-medium text-amber-500 flex items-center">
                              ★ Popular
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Existing Days Section */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold mb-4">Daily Itinerary</h2>
          {selectedTrip.days.map((day) => (
            <div key={day.day} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Day {day.day}</h3>
              </div>
              <div className="p-6">
                <ul className="space-y-4">
                  {day.activities.map((activity, index) => (
                    <li key={index} className="flex items-start">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center mr-3 mt-0.5">
                        <Clock className="w-4 h-4 text-indigo-600" />
                      </div>
                      <span className="text-gray-700">{activity}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DetailView;