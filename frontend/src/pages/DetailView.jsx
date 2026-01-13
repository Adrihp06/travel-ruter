import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Clock, ThumbsUp, ThumbsDown, MapPin, X, Plus } from 'lucide-react';
import useTripStore from '../stores/useTripStore';
import usePOIStore from '../stores/usePOIStore';
import Timeline from '../components/Timeline/Timeline';
import WeatherDisplay from '../components/Weather/WeatherDisplay';
import useDestinationWeather from '../hooks/useDestinationWeather';
import { BudgetDisplay } from '../components/Budget';
import { DocumentPanel } from '../components/Documents';
import { GoogleMapsExportButton } from '../components/GoogleMapsExport';
import { TripMap, DestinationMap, MicroMap } from '../components/Map';
import { Agenda } from '../components/Agenda';

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

// Add POI Modal Component
const AddPOIModal = ({ isOpen, onClose, onSubmit, location }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'Sights',
    estimated_cost: '',
    dwell_time: '30',
  });

  const categories = ['Sights', 'Food', 'Accommodation', 'Museum', 'Shopping', 'Entertainment', 'Activity'];

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      estimated_cost: formData.estimated_cost ? Number(formData.estimated_cost) : 0,
      dwell_time: formData.dwell_time ? Number(formData.dwell_time) : 30,
      latitude: location?.latitude,
      longitude: location?.longitude,
    });
    setFormData({ name: '', description: '', category: 'Sights', estimated_cost: '', dwell_time: '30' });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Add New POI</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Enter POI name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              rows={3}
              placeholder="Brief description of the place"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Est. Cost ($)</label>
              <input
                type="number"
                min="0"
                value={formData.estimated_cost}
                onChange={(e) => setFormData({ ...formData, estimated_cost: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration (min)</label>
              <input
                type="number"
                min="0"
                value={formData.dwell_time}
                onChange={(e) => setFormData({ ...formData, dwell_time: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="30"
              />
            </div>
          </div>
          {location && (
            <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded-lg">
              Location: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
            </div>
          )}
          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add POI</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const DetailView = () => {
  const { id } = useParams();
  const { selectedTrip, budget, fetchTripDetails, isLoading, isBudgetLoading } = useTripStore();
  const { pois, fetchPOIsByDestination, votePOI, createPOI } = usePOIStore();
  const [selectedDestinationId, setSelectedDestinationId] = useState(null);
  // State for Agenda/DestinationMap interaction
  const [selectedPOIs, setSelectedPOIs] = useState([]);
  const [centerOnPOI, setCenterOnPOI] = useState(null);
  // State for MicroMap add POI
  const [showAddPOIModal, setShowAddPOIModal] = useState(false);
  const [pendingPOILocation, setPendingPOILocation] = useState(null);

  // Derive the selected destination object for the WeatherCard
  const selectedDestination = selectedTrip?.destinations?.find(d => d.id === selectedDestinationId);

  // Mock accommodation data (in a real app, this would come from an API)
  const accommodation = selectedDestination ? {
    name: `Hotel ${selectedDestination.name || selectedDestination.city_name}`,
    address: `123 Main Street, ${selectedDestination.name || selectedDestination.city_name}`,
    checkIn: '15:00',
    checkOut: '11:00',
    notes: 'Free WiFi, breakfast included',
  } : null;

  // Handle POI selection for map highlighting (from Agenda)
  const handleSelectPOI = useCallback((poiId) => {
    setSelectedPOIs(prev => {
      if (prev.includes(poiId)) {
        return prev.filter(id => id !== poiId);
      }
      return [...prev, poiId];
    });
  }, []);

  // Handle centering map on a POI (from Agenda)
  const handleCenterMapOnPOI = useCallback((poi) => {
    setCenterOnPOI(poi);
    // Reset after a short delay to allow re-centering on the same POI
    setTimeout(() => setCenterOnPOI(null), 100);
  }, []);

  // Reset selected POIs when destination changes
  useEffect(() => {
    setSelectedPOIs([]);
    setCenterOnPOI(null);
  }, [selectedDestinationId]);

  // Handle adding a new POI from MicroMap click
  const handleAddPOI = useCallback((location) => {
    setPendingPOILocation(location);
    setShowAddPOIModal(true);
  }, []);

  // Handle POI form submission
  const handlePOISubmit = useCallback(async (poiData) => {
    if (selectedDestinationId) {
      await createPOI({
        ...poiData,
        destination_id: selectedDestinationId,
      });
    }
    setPendingPOILocation(null);
  }, [selectedDestinationId, createPOI]);

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
      {/* Timeline Sidebar (Level 1 - Left) */}
      {selectedTrip.destinations && (
        <Timeline
          destinations={selectedTrip.destinations}
          selectedDestinationId={selectedDestinationId}
          onSelectDestination={setSelectedDestinationId}
        />
      )}

      {/* Agenda Panel (Level 2 - Left Panel for Detail View) */}
      {selectedDestination && (
        <Agenda
          destination={selectedDestination}
          accommodation={accommodation}
          pois={pois}
          selectedPOIs={selectedPOIs}
          onSelectPOI={handleSelectPOI}
          onCenterMapOnPOI={handleCenterMapOnPOI}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-8">
        {/* Trip Header with Budget Display */}
        <div className="mb-8">
          <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {selectedTrip.title || selectedTrip.name} (Trip {id})
              </h1>
              <p className="text-gray-500">Detailed itinerary view.</p>

              {/* Export to Google Maps */}
              {selectedTrip?.destinations && selectedTrip.destinations.length >= 2 && (
                <div className="mt-4">
                  <GoogleMapsExportButton destinations={selectedTrip.destinations} />
                </div>
              )}
            </div>
            <div className="xl:w-96">
              <BudgetDisplay budget={budget} isLoading={isBudgetLoading} />
            </div>
          </div>
        </div>

        {/* Trip Overview Map - Shows all destinations with routes */}
        {selectedTrip?.destinations && selectedTrip.destinations.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <MapPin className="w-5 h-5 mr-2 text-indigo-600" />
              Trip Route Overview
            </h2>
            <TripMap
              destinations={selectedTrip.destinations}
              selectedDestinationId={selectedDestinationId}
              onSelectDestination={setSelectedDestinationId}
              showRoute={true}
              height="350px"
            />
          </div>
        )}

        {/* Selected Destination Details */}
        {selectedDestination && (
          <div className="mb-8 p-6 bg-indigo-50 rounded-xl border border-indigo-100">
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-indigo-900 mb-2">
                  {selectedDestination.name}
                </h2>
                <p className="text-sm text-indigo-700 mb-4">
                  {new Date(selectedDestination.arrivalDate).toLocaleDateString()} - {new Date(selectedDestination.departureDate).toLocaleDateString()}
                </p>
                <DestinationWeatherCard destination={selectedDestination} />
              </div>
              <div className="lg:w-96">
                <DestinationMap
                  destination={selectedDestination}
                  pois={pois}
                  height="250px"
                  zoom={11}
                  selectedPOIs={selectedPOIs}
                  centerOnPOI={centerOnPOI}
                  onPOIClick={handleCenterMapOnPOI}
                />
              </div>
            </div>
          </div>
        )}

        {/* POI Section with Voting */}
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

        {/* Daily Itinerary Section */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold mb-4">Daily Itinerary</h2>
          {selectedTrip.days && selectedTrip.days.map((day) => (
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

      {/* Right Sidebar - Micro Map and Documents */}
      <div className="w-96 flex-shrink-0 border-l border-gray-200 overflow-y-auto">
        <div className="sticky top-0">
          {/* Micro Map Section */}
          {selectedDestination && (
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                <MapPin className="w-4 h-4 mr-2 text-indigo-600" />
                {selectedDestination.city_name || selectedDestination.name} Map
              </h3>
              <MicroMap
                destination={selectedDestination}
                pois={pois}
                height="350px"
                zoom={14}
                showLegend={true}
                enableAddPOI={true}
                onAddPOI={handleAddPOI}
              />
              <p className="text-xs text-gray-500 mt-2">
                Click on markers for details. Click "Add POI" to add new locations.
              </p>
            </div>
          )}

          {/* Document Panel */}
          <div className="p-4">
            <DocumentPanel tripId={Number(id)} title="The Vault" />
          </div>
        </div>
      </div>

      {/* Add POI Modal */}
      <AddPOIModal
        isOpen={showAddPOIModal}
        onClose={() => {
          setShowAddPOIModal(false);
          setPendingPOILocation(null);
        }}
        onSubmit={handlePOISubmit}
        location={pendingPOILocation}
      />
    </div>
  );
};

export default DetailView;
