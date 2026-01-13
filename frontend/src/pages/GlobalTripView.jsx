import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, ArrowRight } from 'lucide-react';
import useTripStore from '../stores/useTripStore';
import MapComponent from '../components/Map/Map';

const GlobalTripView = () => {
  const { trips, fetchTrips, isLoading } = useTripStore();

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Loading trips...</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Trips</h1>
      
      <div className="mb-8 h-96 rounded-xl overflow-hidden shadow-sm border border-gray-200">
        <MapComponent />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {trips.map((trip) => (
          <div key={trip.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <MapPin className="w-6 h-6 text-indigo-600" />
              </div>
              <span className="text-sm text-gray-500 bg-gray-50 px-2 py-1 rounded-full">{trip.date}</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{trip.title}</h3>
            <p className="text-gray-500 text-sm mb-4">Exploring {trip.location} and surrounding areas.</p>
            <Link 
              to={`/trips/${trip.id}`} 
              className="inline-flex items-center text-indigo-600 font-medium hover:text-indigo-700"
            >
              View Itinerary <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GlobalTripView;
