import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FileText, Calendar, MapPin } from 'lucide-react';
import Breadcrumbs from '../components/Layout/Breadcrumbs';
import ExportWriterView from '../components/ExportWriter/ExportWriterView';
import useTripStore from '../stores/useTripStore';

const ExportWriterPage = () => {
  const { tripId } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { tripsWithDestinations, fetchTripsSummary, isLoading } = useTripStore();

  useEffect(() => {
    if (!tripsWithDestinations || tripsWithDestinations.length === 0) {
      fetchTripsSummary();
    }
  }, []);

  const selectedTrip = tripId
    ? tripsWithDestinations?.find((tr) => String(tr.id) === String(tripId))
    : null;

  if (tripId && selectedTrip) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-6 pt-4 pb-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <Breadcrumbs />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            {t('nav.exportWriter')} — {selectedTrip.name}
          </h1>
        </div>
        <div className="flex-1 min-h-0">
          <ExportWriterView tripId={Number(tripId)} trip={selectedTrip} />
        </div>
      </div>
    );
  }

  // Trip selector view
  return (
    <div className="flex flex-col min-h-full">
      <div className="px-6 pt-4 pb-2 border-b border-gray-200 dark:border-gray-700">
        <Breadcrumbs />
        <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          {t('nav.exportWriter')}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Select a trip to start writing and exporting travel documents.
        </p>
      </div>

      <div className="flex-1 p-6">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-36 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : tripsWithDestinations?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-lg font-medium text-gray-500 dark:text-gray-400">No trips yet</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              Create a trip first to start writing documents.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(tripsWithDestinations || []).map((trip) => (
              <button
                key={trip.id}
                onClick={() => navigate(`/export-writer/${trip.id}`)}
                className="text-left p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-amber-400 dark:hover:border-amber-500 hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors truncate pr-2">
                    {trip.name}
                  </h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                    trip.status === 'planning'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : trip.status === 'completed'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {trip.status}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {trip.location && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{trip.location}</span>
                    </div>
                  )}
                  {(trip.start_date || trip.end_date) && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                      <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>
                        {trip.start_date && new Date(trip.start_date).toLocaleDateString()}
                        {trip.start_date && trip.end_date && ' – '}
                        {trip.end_date && new Date(trip.end_date).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  {trip.destinations && trip.destinations.length > 0 && (
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                      {trip.destinations.length} destination{trip.destinations.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExportWriterPage;
