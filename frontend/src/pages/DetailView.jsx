import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Clock, MapPin, Coffee, Utensils } from 'lucide-react';
import useTripStore from '../stores/useTripStore';

const DetailView = () => {
  const { id } = useParams();
  const { selectedTrip, fetchTripDetails, isLoading } = useTripStore();

  useEffect(() => {
    if (id) {
      fetchTripDetails(id);
    }
  }, [id, fetchTripDetails]);

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Loading itinerary...</div>;
  }

  if (!selectedTrip) {
    return <div className="p-8 text-center text-gray-500">Trip not found</div>;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{selectedTrip.title} (Trip {id})</h1>
        <p className="text-gray-500">Detailed itinerary view.</p>
      </div>

      <div className="space-y-6">
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
  );
};

export default DetailView;
