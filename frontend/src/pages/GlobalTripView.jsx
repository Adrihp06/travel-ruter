import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, ArrowRight } from 'lucide-react';
import useTripStore from '../stores/useTripStore';
import MacroMap from '../components/Map/MacroMap';
import Breadcrumbs from '../components/Layout/Breadcrumbs';

const GlobalTripView = () => {
  const { trips, tripsWithDestinations, fetchTrips, isLoading } = useTripStore();

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Loading trips...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8 pt-24 relative overflow-y-auto">
      <div className="absolute top-6 left-6 z-50">
        <div className="bg-white/80 backdrop-blur-sm px-4 py-2 rounded-xl shadow-sm border border-gray-100">
          <Breadcrumbs className="mb-0" />
        </div>
      </div>

      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">My Trips</h1>

        <div className="mb-10 h-[450px] rounded-2xl overflow-hidden shadow-md border border-gray-200">
          <MacroMap trips={tripsWithDestinations} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {trips.map((trip) => (
            <div key={trip.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-lg transition-all duration-300 group">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-indigo-50 rounded-xl group-hover:bg-indigo-100 transition-colors">
                  <MapPin className="w-6 h-6 text-indigo-600" />
                </div>
                <span className="text-xs font-medium text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">{trip.date}</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">{trip.title}</h3>
              <p className="text-gray-500 text-sm mb-6 leading-relaxed">Exploring {trip.location} and surrounding areas.</p>
              <Link 
                to={`/trips/${trip.id}`} 
                className="inline-flex items-center text-indigo-600 font-semibold hover:text-indigo-700 transition-colors"
              >
                View Itinerary <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GlobalTripView;
