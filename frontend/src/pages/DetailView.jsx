import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { X, Plus } from 'lucide-react';
import useTripStore from '../stores/useTripStore';
import usePOIStore from '../stores/usePOIStore';
import useDocumentStore from '../stores/useDocumentStore';

// Layout components
import { ItineraryUIProvider, useItineraryUI } from '../contexts/ItineraryUIContext';
import SidebarToggle from '../components/UI/SidebarToggle';
import VaultToggle from '../components/UI/VaultToggle';
import Sidebar from '../components/Layout/Sidebar';
import Breadcrumbs from '../components/Layout/Breadcrumbs';
import { DocumentPanel } from '../components/Documents';
import { BudgetDisplay } from '../components/Budget';

// Level 1 components
import Timeline from '../components/Timeline/Timeline';
import { TripMap } from '../components/Map';

// Level 2 components
import { DayBasedAgenda } from '../components/Agenda';
import { MicroMap } from '../components/Map';

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

const DetailViewContent = () => {
  const { id } = useParams();
  const { selectedTrip, budget, fetchTripDetails, isLoading, isBudgetLoading } = useTripStore();
  const { pois, fetchPOIsByDestination, createPOI } = usePOIStore();
  const { documents } = useDocumentStore();
  const { isSidebarVisible, isVaultVisible, toggleSidebar, toggleVault } = useItineraryUI();

  // State
  const [selectedDestinationId, setSelectedDestinationId] = useState(null); // null = Level 1
  const [selectedPOIs, setSelectedPOIs] = useState([]);
  const [centerOnPOI, setCenterOnPOI] = useState(null);
  const [showAddPOIModal, setShowAddPOIModal] = useState(false);
  const [pendingPOILocation, setPendingPOILocation] = useState(null);

  // Derived state
  const viewLevel = selectedDestinationId ? 2 : 1;
  const selectedDestination = selectedTrip?.destinations?.find(d => d.id === selectedDestinationId);

  // Handlers
  const handleSelectDestination = useCallback((destId) => {
    setSelectedDestinationId(destId);
    setSelectedPOIs([]);
    setCenterOnPOI(null);
  }, []);

  const handleBackToLevel1 = useCallback(() => {
    setSelectedDestinationId(null);
    setSelectedPOIs([]);
  }, []);

  const handleSelectPOI = useCallback((poiId) => {
    setSelectedPOIs(prev =>
      prev.includes(poiId) ? prev.filter(id => id !== poiId) : [...prev, poiId]
    );
  }, []);

  const handleCenterMapOnPOI = useCallback((poi) => {
    setCenterOnPOI(poi);
    setTimeout(() => setCenterOnPOI(null), 100);
  }, []);

  const handleAddPOI = useCallback((location) => {
    setPendingPOILocation(location);
    setShowAddPOIModal(true);
  }, []);

  const handlePOISubmit = useCallback(async (poiData) => {
    if (selectedDestinationId) {
      await createPOI({ ...poiData, destination_id: selectedDestinationId });
    }
    setPendingPOILocation(null);
  }, [selectedDestinationId, createPOI]);

  // Effects
  useEffect(() => {
    if (id) fetchTripDetails(id);
  }, [id, fetchTripDetails]);

  // NO auto-select first destination - removed intentionally for Level 1 view

  useEffect(() => {
    if (selectedDestinationId) {
      fetchPOIsByDestination(selectedDestinationId);
    }
  }, [selectedDestinationId, fetchPOIsByDestination]);

  // Loading state
  if (isLoading) {
    return <div className="flex items-center justify-center h-screen text-gray-500">Loading...</div>;
  }

  if (!selectedTrip) {
    return <div className="flex items-center justify-center h-screen text-gray-500">Trip not found</div>;
  }

  return (
    <div className="relative h-screen overflow-hidden flex flex-col">
      {/* Top Navigation Bar */}
      <div className="h-14 flex-shrink-0 bg-white border-b border-gray-200 flex items-center justify-between px-4 z-30">
        {/* Left: Sidebar Toggle */}
        <div className="flex items-center">
          <SidebarToggle onClick={toggleSidebar} />
        </div>

        {/* Center: Breadcrumbs */}
        <div className="flex-1 flex justify-center">
          <div className="bg-gray-50 px-4 py-1.5 rounded-lg">
            <Breadcrumbs className="mb-0" />
          </div>
        </div>

        {/* Right: Vault Toggle */}
        <div className="flex items-center">
          <VaultToggle onClick={toggleVault} documentCount={documents?.length || 0} />
        </div>
      </div>

      {/* Hideable Sidebar */}
      {isSidebarVisible && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50" onClick={toggleSidebar} />
          <Sidebar isOpen={true} onClose={toggleSidebar} />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel */}
        <div className="w-80 flex-shrink-0 border-r border-gray-200 overflow-y-auto">
          {viewLevel === 1 ? (
            <Timeline
              destinations={selectedTrip.destinations || []}
              selectedDestinationId={selectedDestinationId}
              onSelectDestination={handleSelectDestination}
            />
          ) : (
            <DayBasedAgenda
              destination={selectedDestination}
              pois={pois}
              selectedPOIs={selectedPOIs}
              onSelectPOI={handleSelectPOI}
              onCenterMapOnPOI={handleCenterMapOnPOI}
              onBack={handleBackToLevel1}
            />
          )}
        </div>

        {/* Right Panel - Map */}
        <div className="flex-1 relative">
          {viewLevel === 1 ? (
            <TripMap
              destinations={selectedTrip.destinations || []}
              selectedDestinationId={selectedDestinationId}
              onSelectDestination={handleSelectDestination}
              showRoute={true}
              height="100%"
            />
          ) : (
            <MicroMap
              destination={selectedDestination}
              pois={pois}
              height="100%"
              zoom={14}
              showLegend={true}
              enableAddPOI={true}
              onAddPOI={handleAddPOI}
              selectedPOIs={selectedPOIs}
              centerOnPOI={centerOnPOI}
            />
          )}
        </div>
      </div>

      {/* Hideable Vault */}
      {isVaultVisible && (
        <div className="fixed top-14 right-0 bottom-0 w-96 z-40 bg-white shadow-xl border-l border-gray-200 overflow-y-auto">
          {/* Budget Display */}
          <div className="p-4 border-b border-gray-200">
            <BudgetDisplay budget={budget} isLoading={isBudgetLoading} />
          </div>
          {/* Document Panel */}
          <div className="p-4">
            <DocumentPanel tripId={Number(id)} title="The Vault" />
          </div>
        </div>
      )}

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

// Wrapper with context provider
const DetailView = () => {
  return (
    <ItineraryUIProvider>
      <DetailViewContent />
    </ItineraryUIProvider>
  );
};

export default DetailView;
