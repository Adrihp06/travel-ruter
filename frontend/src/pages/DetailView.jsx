import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { X, Plus, Pencil, Trash2 } from 'lucide-react';
import useTripStore from '../stores/useTripStore';
import usePOIStore from '../stores/usePOIStore';
import useDocumentStore from '../stores/useDocumentStore';
import useDestinationStore from '../stores/useDestinationStore';
import useAccommodationStore from '../stores/useAccommodationStore';
import { DestinationFormModal } from '../components/Destination';
import { AccommodationFormModal, AccommodationList, AccommodationTimeline } from '../components/Accommodation';
import { formatDateWithWeekday } from '../utils/dateFormat';

// Layout components
import { ItineraryUIProvider, useItineraryUI } from '../contexts/ItineraryUIContext';
import SidebarToggle from '../components/UI/SidebarToggle';
import VaultToggle from '../components/UI/VaultToggle';
import Sidebar from '../components/Layout/Sidebar';
import Breadcrumbs from '../components/Layout/Breadcrumbs';
import { DocumentVault } from '../components/Documents';

// Level 1 components
import Timeline from '../components/Timeline/Timeline';
import { TripMap } from '../components/Map';

// Level 2 components
import DailyItinerary from '../components/Itinerary/DailyItinerary';
import { MicroMap } from '../components/Map';
import Skeleton from '../components/UI/Skeleton';
import DestinationTimelineSkeleton from '../components/Itinerary/DestinationTimelineSkeleton';
import MapSkeleton from '../components/Map/MapSkeleton';
import DailyItinerarySkeleton from '../components/Itinerary/DailyItinerarySkeleton';
import Spinner from '../components/UI/Spinner';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// Add POI Modal Component (for MicroMap - Level 2)
const AddPOIModal = ({ isOpen, onClose, onSubmit, location, isSaving }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'Sights',
    estimated_cost: '',
    dwell_time: '30',
    address: '',
  });
  const [locationInfo, setLocationInfo] = useState(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);

  const categories = ['Sights', 'Food', 'Accommodation', 'Museum', 'Shopping', 'Entertainment', 'Activity'];

  // Reverse geocode when location changes
  useEffect(() => {
    if (location && isOpen) {
      setIsLoadingLocation(true);
      fetch(`${API_BASE_URL}/geocoding/reverse?lat=${location.latitude}&lon=${location.longitude}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          setLocationInfo(data);
          if (data?.display_name) {
            setFormData(prev => ({ ...prev, address: data.display_name }));
          }
          setIsLoadingLocation(false);
        })
        .catch(() => {
          setLocationInfo(null);
          setIsLoadingLocation(false);
        });
    }
  }, [location, isOpen]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFormData({ name: '', description: '', category: 'Sights', estimated_cost: '', dwell_time: '30', address: '' });
      setLocationInfo(null);
    }
  }, [isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      estimated_cost: formData.estimated_cost ? Number(formData.estimated_cost) : 0,
      dwell_time: formData.dwell_time ? Number(formData.dwell_time) : 30,
      latitude: location?.latitude,
      longitude: location?.longitude,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add New POI</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Location info from reverse geocoding */}
        {location && (
          <div className="px-4 pt-4">
            <div className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 p-3 rounded-lg text-sm">
              {isLoadingLocation ? (
                <span className="flex items-center">
                  <span className="animate-pulse mr-2">...</span> Looking up location...
                </span>
              ) : locationInfo ? (
                <div>
                  <p className="font-medium">{locationInfo.display_name}</p>
                  <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-1">
                    {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                  </p>
                </div>
              ) : (
                <p>{location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</p>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter POI name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Street address (auto-filled from map)"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              rows={2}
              placeholder="Brief description of the place"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Est. Cost ($)</label>
              <input
                type="number"
                min="0"
                value={formData.estimated_cost}
                onChange={(e) => setFormData({ ...formData, estimated_cost: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Duration (min)</label>
              <input
                type="number"
                min="0"
                value={formData.dwell_time}
                onChange={(e) => setFormData({ ...formData, dwell_time: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="30"
              />
            </div>
          </div>
          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {isSaving ? <Spinner className="text-white" /> : <Plus className="w-4 h-4" />}
              <span>{isSaving ? 'Adding...' : 'Add POI'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Edit POI Modal Component
const EditPOIModal = ({ isOpen, onClose, onSubmit, poi, isSaving }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'Sights',
    estimated_cost: '',
    dwell_time: '30',
  });

  const categories = ['Sights', 'Food', 'Accommodation', 'Museum', 'Shopping', 'Entertainment', 'Activity'];

  // Populate form when poi changes
  useEffect(() => {
    if (poi) {
      setFormData({
        name: poi.name || '',
        description: poi.description || '',
        category: poi.category || 'Sights',
        estimated_cost: poi.estimated_cost ? String(poi.estimated_cost) : '',
        dwell_time: poi.dwell_time ? String(poi.dwell_time) : '30',
      });
    }
  }, [poi]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      name: formData.name,
      description: formData.description,
      category: formData.category,
      estimated_cost: formData.estimated_cost ? Number(formData.estimated_cost) : 0,
      dwell_time: formData.dwell_time ? Number(formData.dwell_time) : 30,
    });
  };

  if (!isOpen || !poi) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Edit POI</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter POI name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              rows={3}
              placeholder="Brief description of the place"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Est. Cost ($)</label>
              <input
                type="number"
                min="0"
                value={formData.estimated_cost}
                onChange={(e) => setFormData({ ...formData, estimated_cost: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Duration (min)</label>
              <input
                type="number"
                min="0"
                value={formData.dwell_time}
                onChange={(e) => setFormData({ ...formData, dwell_time: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="30"
              />
            </div>
          </div>
          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {isSaving ? <Spinner className="text-white" /> : <Pencil className="w-4 h-4" />}
              <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Add POI Modal for TripMap (Level 1) - with reverse geocoding and destination selection
const TripMapPOIModal = ({ isOpen, onClose, onSubmit, location, destinations = [] }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    destination_id: '',
    visit_date: '',
    visit_time: '',
    estimated_cost: '',
    dwell_time: '60',
  });
  const [locationInfo, setLocationInfo] = useState(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [errors, setErrors] = useState({});

  const categories = ['Sights', 'Food', 'Accommodation', 'Museum', 'Shopping', 'Entertainment', 'Activity'];

  // Reverse geocode when location changes
  useEffect(() => {
    if (location && isOpen) {
      setIsLoadingLocation(true);
      fetch(`${API_BASE_URL}/geocoding/reverse?lat=${location.latitude}&lon=${location.longitude}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          setLocationInfo(data);
          setIsLoadingLocation(false);
        })
        .catch(() => {
          setLocationInfo(null);
          setIsLoadingLocation(false);
        });
    }
  }, [location, isOpen]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: '',
        description: '',
        category: '',
        destination_id: destinations.length === 1 ? String(destinations[0].id) : '',
        visit_date: '',
        visit_time: '',
        estimated_cost: '',
        dwell_time: '60',
      });
      setErrors({});
    }
  }, [isOpen, destinations]);

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (!formData.category) {
      newErrors.category = 'Category is required';
    }
    if (!formData.destination_id) {
      newErrors.destination_id = 'Please select a destination';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    onSubmit({
      ...formData,
      destination_id: Number(formData.destination_id),
      estimated_cost: formData.estimated_cost ? Number(formData.estimated_cost) : 0,
      dwell_time: formData.dwell_time ? Number(formData.dwell_time) : 60,
      latitude: location?.latitude,
      longitude: location?.longitude,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Add Point of Interest</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Location info from reverse geocoding */}
        {location && (
          <div className="px-4 pt-4">
            <div className="bg-indigo-50 text-indigo-700 p-3 rounded-lg text-sm">
              {isLoadingLocation ? (
                <span className="flex items-center">
                  <span className="animate-spin mr-2">...</span> Looking up location...
                </span>
              ) : locationInfo ? (
                <div>
                  <p className="font-medium">{locationInfo.display_name}</p>
                  <p className="text-xs text-indigo-500 mt-1">
                    {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                  </p>
                </div>
              ) : (
                <p>{location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</p>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                errors.name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter POI name"
            />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
          </div>

          {/* Category - Required */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                errors.category ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Select a category</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            {errors.category && <p className="text-red-500 text-xs mt-1">{errors.category}</p>}
          </div>

          {/* Destination Selection - Required */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Destination *</label>
            {destinations.length === 0 ? (
              <p className="text-amber-600 text-sm bg-amber-50 p-2 rounded-lg">
                No destinations yet. Add a destination first to attach POIs.
              </p>
            ) : (
              <select
                value={formData.destination_id}
                onChange={(e) => setFormData({ ...formData, destination_id: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                  errors.destination_id ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">Select a destination</option>
                {destinations.map((dest) => (
                  <option key={dest.id} value={dest.id}>
                    {dest.city_name}, {dest.country}
                  </option>
                ))}
              </select>
            )}
            {errors.destination_id && <p className="text-red-500 text-xs mt-1">{errors.destination_id}</p>}
          </div>

          {/* Date and Time - Optional */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date (optional)</label>
              <input
                type="date"
                value={formData.visit_date}
                onChange={(e) => setFormData({ ...formData, visit_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time (optional)</label>
              <input
                type="time"
                value={formData.visit_time}
                onChange={(e) => setFormData({ ...formData, visit_time: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              rows={2}
              placeholder="Brief description of the place"
            />
          </div>

          {/* Cost and Duration */}
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
                placeholder="60"
              />
            </div>
          </div>

          {/* Buttons */}
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
              disabled={destinations.length === 0}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
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
  const { selectedTrip, fetchTripDetails, isLoading, setSelectedTripDestinations } = useTripStore();
  const { pois, fetchPOIsByDestination, createPOI, updatePOI, deletePOI, votePOI, updatePOISchedules, isLoading: isPOIsLoading } = usePOIStore();
  const { documents } = useDocumentStore();
  const { deleteDestination, reorderDestinations, setSelectedDestination, resetSelectedDestination, selectedDestination: storeSelectedDestination } = useDestinationStore();
  const { accommodations, fetchAccommodations, deleteAccommodation, isLoading: isAccLoading } = useAccommodationStore();
  const { isSidebarVisible, isVaultVisible, toggleSidebar, toggleVault } = useItineraryUI();

  // State
  const [selectedDestinationId, setSelectedDestinationId] = useState(null); // null = Level 1
  const [selectedPOIs, setSelectedPOIs] = useState([]);
  const [centerOnPOI, setCenterOnPOI] = useState(null);
  const [showAddPOIModal, setShowAddPOIModal] = useState(false);
  const [pendingPOILocation, setPendingPOILocation] = useState(null);
  const [clearPendingTrigger, setClearPendingTrigger] = useState(0);

  // Destination modal state
  const [showDestinationModal, setShowDestinationModal] = useState(false);
  const [editingDestination, setEditingDestination] = useState(null);

  // TripMap POI modal state (Level 1)
  const [showTripMapPOIModal, setShowTripMapPOIModal] = useState(false);
  const [pendingTripMapPOILocation, setPendingTripMapPOILocation] = useState(null);

  // Accommodation modal state
  const [showAccommodationModal, setShowAccommodationModal] = useState(false);
  const [editingAccommodation, setEditingAccommodation] = useState(null);
  const [accommodationPreFillDates, setAccommodationPreFillDates] = useState(null);

  // POI edit modal state
  const [showEditPOIModal, setShowEditPOIModal] = useState(false);
  const [editingPOI, setEditingPOI] = useState(null);

  // Derived state
  const viewLevel = selectedDestinationId ? 2 : 1;
  const selectedDestination = selectedTrip?.destinations?.find(d => d.id === selectedDestinationId);

  const isLevel2Loading = (isPOIsLoading && (!pois || pois.length === 0)) || (isAccLoading && (!accommodations || accommodations.length === 0));

  // Generate days for the selected destination
  const destinationDays = useMemo(() => {
    if (!selectedDestination?.arrival_date || !selectedDestination?.departure_date) return [];

    const days = [];
    const arrival = new Date(selectedDestination.arrival_date);
    const departure = new Date(selectedDestination.departure_date);
    let currentDate = new Date(arrival);
    let dayNumber = 1;

    while (currentDate < departure) {
      days.push({
        dayNumber,
        date: currentDate.toISOString().split('T')[0],
        displayDate: formatDateWithWeekday(currentDate),
      });
      currentDate.setDate(currentDate.getDate() + 1);
      dayNumber++;
    }
    return days;
  }, [selectedDestination?.arrival_date, selectedDestination?.departure_date]);

  // Organize POIs by day for routing
  const poisByDay = useMemo(() => {
    if (!pois || pois.length === 0 || destinationDays.length === 0) return {};

    // Flatten all POIs from category groups
    const allPOIs = pois.flatMap((group) => group.pois || []);

    // Group POIs by scheduled date
    const byDay = {};
    destinationDays.forEach((day) => {
      byDay[day.date] = [];
    });

    allPOIs.forEach((poi) => {
      if (poi.scheduled_date && poi.latitude && poi.longitude && byDay[poi.scheduled_date]) {
        byDay[poi.scheduled_date].push(poi);
      }
    });

    // Sort each day's POIs by day_order
    Object.keys(byDay).forEach((date) => {
      byDay[date].sort((a, b) => (a.day_order || 0) - (b.day_order || 0));
    });

    return byDay;
  }, [pois, destinationDays]);

  // Handlers
  const handleSelectDestination = useCallback((destId) => {
    setSelectedDestinationId(destId);
    setSelectedPOIs([]);
    setCenterOnPOI(null);
    // Sync with store for breadcrumb display
    const dest = selectedTrip?.destinations?.find(d => d.id === destId);
    if (dest) {
      setSelectedDestination(dest);
    }
  }, [selectedTrip?.destinations, setSelectedDestination]);

  const handleBackToLevel1 = useCallback(() => {
    setSelectedDestinationId(null);
    setSelectedPOIs([]);
    resetSelectedDestination();
  }, [resetSelectedDestination]);

  const handleSelectPOI = useCallback((poiId) => {
    setSelectedPOIs(prev =>
      prev.includes(poiId) ? prev.filter(id => id !== poiId) : [...prev, poiId]
    );
  }, []);

  const handleCenterMapOnPOI = useCallback((poi) => {
    setCenterOnPOI(poi);
    setTimeout(() => setCenterOnPOI(null), 100);
  }, []);

  // Center map on accommodation
  const handleCenterOnAccommodation = useCallback((acc) => {
    if (acc.latitude && acc.longitude) {
      setCenterOnPOI({ latitude: acc.latitude, longitude: acc.longitude, name: acc.name });
      setTimeout(() => setCenterOnPOI(null), 100);
    }
  }, []);

  const handleAddPOI = useCallback((location) => {
    setPendingPOILocation(location);
    setShowAddPOIModal(true);
  }, []);

  // Handle adding POI via TripMap click (Level 1)
  const handleAddPOIFromTripMap = useCallback((location) => {
    setPendingTripMapPOILocation(location);
    setShowTripMapPOIModal(true);
  }, []);

  // Handle TripMap POI submission
  const handleTripMapPOISubmit = useCallback(async (poiData) => {
    await createPOI(poiData);
    // Refresh the trip details to show updated POI counts
    fetchTripDetails(id);
    setPendingTripMapPOILocation(null);
  }, [createPOI, fetchTripDetails, id]);

  const handlePOISubmit = useCallback(async (poiData) => {
    if (selectedDestinationId) {
      await createPOI({ ...poiData, destination_id: selectedDestinationId });
      setShowAddPOIModal(false);
    }
    setPendingPOILocation(null);
  }, [selectedDestinationId, createPOI]);

  // POI Edit handler
  const handleEditPOI = useCallback((poi) => {
    setEditingPOI(poi);
    setShowEditPOIModal(true);
  }, []);

  // POI Edit submit
  const handleEditPOISubmit = useCallback(async (poiData) => {
    if (editingPOI) {
      await updatePOI(editingPOI.id, poiData);
      setShowEditPOIModal(false);
      setEditingPOI(null);
    }
  }, [editingPOI, updatePOI]);

  // POI Delete handler
  const handleDeletePOI = useCallback(async (poi) => {
    if (window.confirm(`Delete "${poi.name}"? This action cannot be undone.`)) {
      await deletePOI(poi.id);
    }
  }, [deletePOI]);

  // POI Vote handler
  const handleVotePOI = useCallback(async (poiId, voteType) => {
    await votePOI(poiId, voteType);
  }, [votePOI]);

// Reorder destinations handler
  const handleReorderDestinations = useCallback(async (destinationIds) => {
    const previousDestinations = selectedTrip?.destinations || [];

    // Optimistic update: immediately reorder in trip store to prevent visual snapback
    const reorderedDestinations = destinationIds.map((destId, index) => {
      const dest = previousDestinations.find(d => d.id === destId);
      return { ...dest, order_index: index };
    });
    setSelectedTripDestinations(reorderedDestinations);

    try {
      // Call API and get updated destinations with new order and dates
      const updatedDestinations = await reorderDestinations(Number(id), destinationIds);
      // Update with server response (may include recalculated dates, etc.)
      setSelectedTripDestinations(updatedDestinations);
    } catch (error) {
      console.error('Failed to reorder destinations:', error);
      // On error, rollback to previous state
      setSelectedTripDestinations(previousDestinations);
      // Also refresh from server to ensure consistency
      fetchTripDetails(id);
    }
  }, [id, selectedTrip?.destinations, reorderDestinations, setSelectedTripDestinations, fetchTripDetails]);

  // POI Schedule change handler (for drag-and-drop)
  const handleScheduleChange = useCallback(async (updates) => {
    if (selectedDestinationId) {
      await updatePOISchedules(selectedDestinationId, updates);
    }
  }, [selectedDestinationId, updatePOISchedules]);

  // Delete handlers
  const handleDeleteDestination = useCallback(async (destId) => {
    if (window.confirm('Delete this destination and all its POIs?')) {
      await deleteDestination(destId);
      if (selectedDestinationId === destId) {
        setSelectedDestinationId(null); // Return to Level 1
      }
      // Refresh trip details
      fetchTripDetails(id);
    }
  }, [deleteDestination, selectedDestinationId, fetchTripDetails, id]);

  const handleDeleteAccommodation = useCallback(async (accId) => {
    if (window.confirm('Delete this accommodation?')) {
      await deleteAccommodation(accId);
    }
  }, [deleteAccommodation]);

  // Handler for adding accommodation from timeline gap
  const handleAddAccommodationForGap = useCallback((startDate, endDate) => {
    setAccommodationPreFillDates({ check_in_date: startDate, check_out_date: endDate });
    setEditingAccommodation(null);
    setShowAccommodationModal(true);
  }, []);

  // Handler for accommodation modal close
  const handleAccommodationModalClose = useCallback(() => {
    setShowAccommodationModal(false);
    setEditingAccommodation(null);
    setAccommodationPreFillDates(null);
  }, []);

  // Effects
  useEffect(() => {
    if (id) fetchTripDetails(id);
  }, [id, fetchTripDetails]);

  // NO auto-select first destination - removed intentionally for Level 1 view

  useEffect(() => {
    if (selectedDestinationId) {
      fetchPOIsByDestination(selectedDestinationId);
      fetchAccommodations(selectedDestinationId);
    }
  }, [selectedDestinationId, fetchPOIsByDestination, fetchAccommodations]);

  // Sync local state with store (for breadcrumb navigation back to trip level)
  useEffect(() => {
    if (storeSelectedDestination === null && selectedDestinationId !== null) {
      setSelectedDestinationId(null);
      setSelectedPOIs([]);
    }
  }, [storeSelectedDestination, selectedDestinationId]);

  // Loading state
  if (isLoading) {
    return (
      <div className="relative h-screen overflow-hidden flex flex-col bg-gray-50 dark:bg-gray-900 transition-colors">
         {/* Navbar Skeleton */}
         <div className="h-14 flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 z-30">
             <Skeleton className="h-8 w-8 rounded-lg" />
             <Skeleton className="h-8 w-64 rounded-lg" />
             <Skeleton className="h-8 w-8 rounded-lg" />
         </div>
         <div className="flex flex-1 overflow-hidden">
             <DestinationTimelineSkeleton />
             <div className="flex-1 relative p-4">
                <MapSkeleton className="h-full rounded-xl shadow-inner border border-gray-200 dark:border-gray-700" />
             </div>
         </div>
      </div>
    );
  }

  if (!selectedTrip) {
    return <div className="flex items-center justify-center h-screen text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900">Trip not found</div>;
  }

  return (
    <div className="relative h-screen overflow-hidden flex flex-col bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Top Navigation Bar */}
      <div className="h-14 flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 z-30 transition-colors">
        {/* Left: Sidebar Toggle */}
        <div className="flex items-center">
          <SidebarToggle onClick={toggleSidebar} />
        </div>

        {/* Center: Breadcrumbs */}
        <div className="flex-1 flex justify-center">
          <div className="bg-gray-50 dark:bg-gray-700 px-4 py-1.5 rounded-lg">
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
        <div className={`${viewLevel === 2 ? 'w-96' : 'w-80'} flex-shrink-0 border-r border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800 transition-all duration-200`}>
          {viewLevel === 1 ? (
            <Timeline
              destinations={selectedTrip.destinations || []}
              tripId={Number(id)}
              selectedDestinationId={selectedDestinationId}
              onSelectDestination={handleSelectDestination}
              onAddDestination={() => {
                setEditingDestination(null);
                setShowDestinationModal(true);
              }}
              onEditDestination={(dest) => {
                setEditingDestination(dest);
                setShowDestinationModal(true);
              }}
              onDeleteDestination={handleDeleteDestination}
              onReorderDestinations={handleReorderDestinations}
            />
          ) : isLevel2Loading ? (
            <DailyItinerarySkeleton />
          ) : (
            <div className="flex flex-col h-full">
              <div className="flex-1 overflow-hidden">
                <DailyItinerary
                  destination={selectedDestination}
                  pois={pois}
                  onScheduleChange={handleScheduleChange}
                  onBack={handleBackToLevel1}
                  onEditPOI={handleEditPOI}
                  onDeletePOI={handleDeletePOI}
                  onVotePOI={handleVotePOI}
                  onPOIClick={handleCenterMapOnPOI}
                  className="h-full"
                />
              </div>

              {/* Accommodation Section with Timeline */}
              <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex-shrink-0">
                <AccommodationTimeline
                  destination={selectedDestination}
                  accommodations={accommodations}
                  onAddForGap={handleAddAccommodationForGap}
                  onEditAccommodation={(acc) => {
                    setEditingAccommodation(acc);
                    setAccommodationPreFillDates(null);
                    setShowAccommodationModal(true);
                  }}
                  onCenterOnAccommodation={handleCenterOnAccommodation}
                  onAddAccommodation={() => {
                    setEditingAccommodation(null);
                    setAccommodationPreFillDates(null);
                    setShowAccommodationModal(true);
                  }}
                />
              </div>
            </div>
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
              tripId={Number(id)}
              tripLocation={
                selectedTrip.latitude && selectedTrip.longitude
                  ? {
                      latitude: selectedTrip.latitude,
                      longitude: selectedTrip.longitude,
                      name: selectedTrip.location,
                    }
                  : null
              }
              enableAddPOI={true}
              onAddPOI={handleAddPOIFromTripMap}
              originPoint={
                selectedTrip.origin_name && selectedTrip.origin_latitude && selectedTrip.origin_longitude
                  ? {
                      name: selectedTrip.origin_name,
                      latitude: selectedTrip.origin_latitude,
                      longitude: selectedTrip.origin_longitude,
                    }
                  : null
              }
              returnPoint={
                selectedTrip.return_name && selectedTrip.return_latitude && selectedTrip.return_longitude
                  ? {
                      name: selectedTrip.return_name,
                      latitude: selectedTrip.return_latitude,
                      longitude: selectedTrip.return_longitude,
                    }
                  : selectedTrip.origin_name && selectedTrip.origin_latitude && selectedTrip.origin_longitude
                    ? {
                        name: selectedTrip.origin_name,
                        latitude: selectedTrip.origin_latitude,
                        longitude: selectedTrip.origin_longitude,
                      }
                    : null
              }
            />
          ) : isLevel2Loading ? (
            <MapSkeleton height="100%" />
          ) : (
            <MicroMap
              destination={selectedDestination}
              pois={pois}
              accommodations={accommodations}
              height="100%"
              zoom={14}
              showLegend={true}
              enableAddPOI={true}
              onAddPOI={handleAddPOI}
              selectedPOIs={selectedPOIs}
              centerOnPOI={centerOnPOI}
              onVotePOI={handleVotePOI}
              onEditPOI={handleEditPOI}
              onDeletePOI={handleDeletePOI}
              onEditAccommodation={(acc) => {
                setEditingAccommodation(acc);
                setShowAccommodationModal(true);
              }}
              onDeleteAccommodation={handleDeleteAccommodation}
              clearPendingTrigger={clearPendingTrigger}
              showRouteControls={true}
              days={destinationDays}
              poisByDay={poisByDay}
            />
          )}
        </div>
      </div>

      {/* Document Vault Drawer */}
      <DocumentVault
        tripId={Number(id)}
        isOpen={isVaultVisible}
        onClose={toggleVault}
      />

      {/* Add POI Modal */}
      <AddPOIModal
        isOpen={showAddPOIModal}
        onClose={() => {
          setShowAddPOIModal(false);
          setPendingPOILocation(null);
          setClearPendingTrigger(prev => prev + 1);
        }}
        onSubmit={handlePOISubmit}
        location={pendingPOILocation}
        isSaving={isPOIsLoading}
      />

      {/* TripMap POI Modal (Level 1) */}
      <TripMapPOIModal
        isOpen={showTripMapPOIModal}
        onClose={() => {
          setShowTripMapPOIModal(false);
          setPendingTripMapPOILocation(null);
        }}
        onSubmit={handleTripMapPOISubmit}
        location={pendingTripMapPOILocation}
        destinations={selectedTrip?.destinations || []}
      />

      {/* Destination Form Modal */}
      <DestinationFormModal
        isOpen={showDestinationModal}
        onClose={() => {
          setShowDestinationModal(false);
          setEditingDestination(null);
        }}
        tripId={Number(id)}
        destination={editingDestination}
        onSuccess={() => fetchTripDetails(id)}
        trip={selectedTrip}
      />

      {/* Accommodation Form Modal */}
      <AccommodationFormModal
        isOpen={showAccommodationModal}
        onClose={handleAccommodationModalClose}
        destinationId={selectedDestinationId}
        destination={selectedDestination}
        accommodation={editingAccommodation}
        preFillDates={accommodationPreFillDates}
        onSuccess={() => fetchAccommodations(selectedDestinationId)}
      />

      {/* Edit POI Modal */}
      <EditPOIModal
        isOpen={showEditPOIModal}
        onClose={() => {
          setShowEditPOIModal(false);
          setEditingPOI(null);
        }}
        onSubmit={handleEditPOISubmit}
        poi={editingPOI}
        isSaving={isPOIsLoading}
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
