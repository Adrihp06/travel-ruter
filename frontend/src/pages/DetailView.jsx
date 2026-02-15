import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Plus, Users, Activity } from 'lucide-react';
import XIcon from '@/components/icons/x-icon';
import PenIcon from '@/components/icons/pen-icon';
import useTripStore from '../stores/useTripStore';
import usePOIStore from '../stores/usePOIStore';
import useDocumentStore from '../stores/useDocumentStore';
import useDestinationStore from '../stores/useDestinationStore';
import useAccommodationStore from '../stores/useAccommodationStore';
import useNoteStore from '../stores/useNoteStore';
import useAIStore from '../stores/useAIStore';
import useAuthStore from '../stores/useAuthStore';
import PresenceBar from '../components/Collaboration/PresenceBar';
import TripMemberList from '../components/Collaboration/TripMemberList';
import InviteMemberModal from '../components/Collaboration/InviteMemberModal';
import ActivityFeed from '../components/Activity/ActivityFeed';
import CommentThread from '../components/Comments/CommentThread';
import { DestinationFormModal } from '../components/Destination';
import { AccommodationFormModal, AccommodationList, AccommodationTimeline } from '../components/Accommodation';
import { formatDateWithWeekday, parseDateString } from '../utils/dateFormat';

// Layout components
import { ItineraryUIProvider, useItineraryUI, calendarAnimationClasses } from '../contexts/ItineraryUIContext';
import SidebarToggle from '../components/UI/SidebarToggle';
import VaultToggle from '../components/UI/VaultToggle';
import CalendarViewToggle from '../components/UI/CalendarViewToggle';
import JournalToggle from '../components/UI/JournalToggle';
import Sidebar from '../components/Layout/Sidebar';
import Breadcrumbs from '../components/Layout/Breadcrumbs';
import { DocumentVault } from '../components/Documents';
import { Journal, NoteFormModal } from '../components/Journal';

// Level 1 components
import Timeline from '../components/Timeline/Timeline';
import { TripMap } from '../components/Map';
import CalendarView from '../components/Calendar/CalendarView';

// Level 2 components
import DailyItinerary from '../components/Itinerary/DailyItinerary';
import { MicroMap } from '../components/Map';
import Skeleton from '../components/UI/Skeleton';
import DestinationTimelineSkeleton from '../components/Itinerary/DestinationTimelineSkeleton';
import MapPlaceholder from '../components/Map/MapPlaceholder';
import DailyItinerarySkeleton from '../components/Itinerary/DailyItinerarySkeleton';
import Spinner from '../components/UI/Spinner';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// Add POI Modal Component (for MicroMap - Level 2)
const AddPOIModal = ({ isOpen, onClose, onSubmit, location, isSaving }) => {
  const { t } = useTranslation();
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
      // If location already has pre-filled data, use it
      if (location.preFill && formData.name === '') {
        setFormData(prev => ({
          ...prev,
          name: location.preFill.name || prev.name,
          address: location.preFill.address || prev.address,
          description: location.preFill.description || prev.description,
          category: location.preFill.category || prev.category,
        }));
        setIsLoadingLocation(false);
        return;
      }

      const controller = new AbortController();
      setIsLoadingLocation(true);

      const fetchGeocode = async () => {
        try {
          const res = await fetch(
            `${API_BASE_URL}/geocoding/reverse?lat=${location.latitude}&lon=${location.longitude}`,
            { signal: controller.signal }
          );
          const data = res.ok ? await res.json() : null;
          setLocationInfo(data);
          if (data?.display_name) {
            setFormData(prev => ({ ...prev, address: data.display_name }));
          }
          setIsLoadingLocation(false);
        } catch (err) {
          if (err.name !== 'AbortError') {
            setLocationInfo(null);
            setIsLoadingLocation(false);
          }
        }
      };

      fetchGeocode();

      return () => controller.abort();
    }
  }, [location, isOpen]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen && (formData.name !== '' || formData.address !== '')) {
      setFormData({ name: '', description: '', category: 'Sights', estimated_cost: '', dwell_time: '30', address: '' });
      setLocationInfo(null);
    }
  }, [isOpen, formData.name, formData.address]);

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
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('poi.addPoi')}</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <XIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Location info - shown only when resolved */}
        {location && locationInfo && (
          <div className="px-4 pt-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {locationInfo.display_name} · {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.name')} *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#D97706]/50 focus:border-[#D97706] bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder={t('common.name')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('poi.category')}</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#D97706]/50 focus:border-[#D97706] bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.address')}</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#D97706]/50 focus:border-[#D97706] bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder={t('common.address')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.description')}</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#D97706]/50 focus:border-[#D97706] bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              rows={2}
              placeholder={t('common.description')}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('poi.estimatedCost')}</label>
              <input
                type="number"
                min="0"
                value={formData.estimated_cost}
                onChange={(e) => setFormData({ ...formData, estimated_cost: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#D97706]/50 focus:border-[#D97706] bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('poi.dwellTime')}</label>
              <input
                type="number"
                min="0"
                value={formData.dwell_time}
                onChange={(e) => setFormData({ ...formData, dwell_time: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#D97706]/50 focus:border-[#D97706] bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-[#D97706] text-white rounded-lg hover:bg-[#B45309] transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {isSaving ? <Spinner className="text-white" /> : <Plus className="w-4 h-4" />}
              <span>{isSaving ? t('poi.adding') : t('poi.addPoi')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Edit POI Modal Component
const EditPOIModal = ({ isOpen, onClose, onSubmit, poi, isSaving }) => {
  const { t } = useTranslation();
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
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('poi.editPoi')}</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <XIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.name')} *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#D97706]/50 focus:border-[#D97706] bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder={t('common.name')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('poi.category')}</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#D97706]/50 focus:border-[#D97706] bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.description')}</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#D97706]/50 focus:border-[#D97706] bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              rows={3}
              placeholder={t('common.description')}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('poi.estimatedCost')}</label>
              <input
                type="number"
                min="0"
                value={formData.estimated_cost}
                onChange={(e) => setFormData({ ...formData, estimated_cost: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#D97706]/50 focus:border-[#D97706] bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('poi.dwellTime')}</label>
              <input
                type="number"
                min="0"
                value={formData.dwell_time}
                onChange={(e) => setFormData({ ...formData, dwell_time: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#D97706]/50 focus:border-[#D97706] bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-[#D97706] text-white rounded-lg hover:bg-[#B45309] transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {isSaving ? <Spinner className="text-white" /> : <PenIcon className="w-4 h-4" />}
              <span>{isSaving ? t('common.saving') : t('common.save')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Add POI Modal for TripMap (Level 1) - with reverse geocoding and destination selection
const TripMapPOIModal = ({ isOpen, onClose, onSubmit, location, destinations = [] }) => {
  const { t } = useTranslation();
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
      const controller = new AbortController();
      setIsLoadingLocation(true);

      const fetchGeocode = async () => {
        try {
          const res = await fetch(
            `${API_BASE_URL}/geocoding/reverse?lat=${location.latitude}&lon=${location.longitude}`,
            { signal: controller.signal }
          );
          const data = res.ok ? await res.json() : null;
          setLocationInfo(data);
          setIsLoadingLocation(false);
        } catch (err) {
          if (err.name !== 'AbortError') {
            setLocationInfo(null);
            setIsLoadingLocation(false);
          }
        }
      };

      fetchGeocode();

      return () => controller.abort();
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
      newErrors.name = t('poi.nameRequired');
    }
    if (!formData.category) {
      newErrors.category = t('poi.categoryRequired');
    }
    if (!formData.destination_id) {
      newErrors.destination_id = t('poi.destinationRequired');
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
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('poi.addPoi')}</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <XIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Location info - shown only when resolved */}
        {location && locationInfo && (
          <div className="px-4 pt-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {locationInfo.display_name} · {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.name')} *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#D97706]/50 focus:border-[#D97706] bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                errors.name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder={t('poi.enterPoiName')}
            />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
          </div>

          {/* Category - Required */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('poi.category')} *</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#D97706]/50 focus:border-[#D97706] bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                errors.category ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
            >
              <option value="">{t('poi.selectCategory')}</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            {errors.category && <p className="text-red-500 text-xs mt-1">{errors.category}</p>}
          </div>

          {/* Destination Selection - Required */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('trips.destination')} *</label>
            {destinations.length === 0 ? (
              <p className="text-amber-600 dark:text-amber-400 text-sm bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg">
                {t('poi.noDestinationsAddFirst')}
              </p>
            ) : (
              <select
                value={formData.destination_id}
                onChange={(e) => setFormData({ ...formData, destination_id: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#D97706]/50 focus:border-[#D97706] bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                  errors.destination_id ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
              >
                <option value="">{t('poi.selectDestination')}</option>
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('poi.dateOptional')}</label>
              <input
                type="date"
                value={formData.visit_date}
                onChange={(e) => setFormData({ ...formData, visit_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#D97706]/50 focus:border-[#D97706] bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('poi.timeOptional')}</label>
              <input
                type="time"
                value={formData.visit_time}
                onChange={(e) => setFormData({ ...formData, visit_time: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#D97706]/50 focus:border-[#D97706] bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.description')}</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#D97706]/50 focus:border-[#D97706] bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              rows={2}
              placeholder={t('poi.briefDescription')}
            />
          </div>

          {/* Cost and Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('poi.estCostDollar')}</label>
              <input
                type="number"
                min="0"
                value={formData.estimated_cost}
                onChange={(e) => setFormData({ ...formData, estimated_cost: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#D97706]/50 focus:border-[#D97706] bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('poi.durationMinutes')}</label>
              <input
                type="number"
                min="0"
                value={formData.dwell_time}
                onChange={(e) => setFormData({ ...formData, dwell_time: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#D97706]/50 focus:border-[#D97706] bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="60"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={destinations.length === 0}
              className="flex-1 px-4 py-2 bg-[#D97706] text-white rounded-lg hover:bg-[#B45309] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>{t('poi.addPoi')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const DetailViewContent = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const { selectedTrip, fetchTripDetails, isLoading, setSelectedTripDestinations } = useTripStore();
  const { pois, fetchPOIsByDestination, createPOI, updatePOI, deletePOI, votePOI, updatePOISchedules, isLoading: isPOIsLoading } = usePOIStore();
  const { documents } = useDocumentStore();
  const { deleteDestination, reorderDestinations, setSelectedDestination, resetSelectedDestination, selectedDestination: storeSelectedDestination } = useDestinationStore();
  const { accommodations, accommodationsByDestination, fetchAccommodations, fetchAccommodationsForTrip, deleteAccommodation, isLoading: isAccLoading } = useAccommodationStore();
  const { noteStats, fetchNoteStats } = useNoteStore();
  const setDestinationContext = useAIStore(state => state.setDestinationContext);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { isSidebarVisible, isVaultVisible, isCalendarVisible, isJournalVisible, toggleSidebar, toggleVault, toggleCalendar, toggleJournal } = useItineraryUI();

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
  const [destinationPreFilledLocation, setDestinationPreFilledLocation] = useState(null);

  // Accommodation modal state
  const [showAccommodationModal, setShowAccommodationModal] = useState(false);
  const [editingAccommodation, setEditingAccommodation] = useState(null);
  const [accommodationPreFillDates, setAccommodationPreFillDates] = useState(null);

  // POI edit modal state
  const [showEditPOIModal, setShowEditPOIModal] = useState(false);
  const [editingPOI, setEditingPOI] = useState(null);

  // Note form modal state (for quick-add from daily schedule)
  const [showNoteFormModal, setShowNoteFormModal] = useState(false);
  const [noteFormPreFill, setNoteFormPreFill] = useState(null);

  // Collaboration & Activity panel state
  const [showMembersPanel, setShowMembersPanel] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showActivityPanel, setShowActivityPanel] = useState(false);

  // Derived state
  const viewLevel = selectedDestinationId ? 2 : 1;
  const selectedDestination = selectedTrip?.destinations?.find(d => d.id === selectedDestinationId);

  // Separate loading states for progressive rendering:
  // - isMapReady: Map can render with destination coordinates (immediate)
  // - isDataOverlayLoading: Show overlay while POIs/accommodations load (non-blocking)
  const isMapReady = selectedDestination?.latitude && selectedDestination?.longitude;
  const isDataOverlayLoading = isPOIsLoading || isAccLoading;
  // Only block left panel content when we have NO data yet
  const isLeftPanelLoading = (isPOIsLoading && (!pois || pois.length === 0));

  // Generate days for the selected destination
  // Uses parseDateString to avoid UTC timezone off-by-one errors
  const destinationDays = useMemo(() => {
    if (!selectedDestination?.arrival_date || !selectedDestination?.departure_date) return [];

    const arrival = parseDateString(selectedDestination.arrival_date);
    const departure = parseDateString(selectedDestination.departure_date);
    if (!arrival || !departure) return [];

    const days = [];
    let dayNumber = 1;
    const current = new Date(arrival.getFullYear(), arrival.getMonth(), arrival.getDate());
    const end = new Date(departure.getFullYear(), departure.getMonth(), departure.getDate());

    while (current < end) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const day = String(current.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      days.push({
        dayNumber,
        date: dateStr,
        displayDate: formatDateWithWeekday(dateStr),
      });
      current.setDate(current.getDate() + 1);
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

  // Memoize trip location objects to prevent unnecessary re-renders of TripMap
  const tripLocation = useMemo(() => {
    if (!selectedTrip?.latitude || !selectedTrip?.longitude) return null;
    return {
      latitude: selectedTrip.latitude,
      longitude: selectedTrip.longitude,
      name: selectedTrip.location,
    };
  }, [selectedTrip?.latitude, selectedTrip?.longitude, selectedTrip?.location]);

  const originPoint = useMemo(() => {
    if (!selectedTrip?.origin_name || !selectedTrip?.origin_latitude || !selectedTrip?.origin_longitude) return null;
    return {
      name: selectedTrip.origin_name,
      latitude: selectedTrip.origin_latitude,
      longitude: selectedTrip.origin_longitude,
    };
  }, [selectedTrip?.origin_name, selectedTrip?.origin_latitude, selectedTrip?.origin_longitude]);

  const returnPoint = useMemo(() => {
    if (selectedTrip?.return_name && selectedTrip?.return_latitude && selectedTrip?.return_longitude) {
      return {
        name: selectedTrip.return_name,
        latitude: selectedTrip.return_latitude,
        longitude: selectedTrip.return_longitude,
      };
    }
    // Fall back to origin point if no return point specified
    if (selectedTrip?.origin_name && selectedTrip?.origin_latitude && selectedTrip?.origin_longitude) {
      return {
        name: selectedTrip.origin_name,
        latitude: selectedTrip.origin_latitude,
        longitude: selectedTrip.origin_longitude,
      };
    }
    return null;
  }, [
    selectedTrip?.return_name,
    selectedTrip?.return_latitude,
    selectedTrip?.return_longitude,
    selectedTrip?.origin_name,
    selectedTrip?.origin_latitude,
    selectedTrip?.origin_longitude,
  ]);

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

  // Handle adding destination via TripMap click (Level 1)
  const handleAddDestinationFromMap = useCallback((location) => {
    setDestinationPreFilledLocation(location);
    setEditingDestination(null);
    setShowDestinationModal(true);
  }, []);

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
      try {
        await deleteDestination(destId);
        if (selectedDestinationId === destId) {
          setSelectedDestinationId(null); // Return to Level 1
        }
        // Refresh trip details
        fetchTripDetails(id);
      } catch (error) {
        console.error('Failed to delete destination:', error);
        alert('Failed to delete destination. Please try again.');
      }
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

  // Handler for adding a day note from the daily schedule
  const handleAddDayNoteFromSchedule = useCallback((dayNumber, date) => {
    setNoteFormPreFill({
      destination_id: selectedDestinationId,
      day_number: dayNumber,
      note_type: 'day',
    });
    setShowNoteFormModal(true);
  }, [selectedDestinationId]);

  // Handler for adding a POI note from the daily schedule
  const handleAddPOINoteFromSchedule = useCallback((poi) => {
    setNoteFormPreFill({
      destination_id: selectedDestinationId,
      poi_id: poi.id,
      note_type: 'poi',
    });
    setShowNoteFormModal(true);
  }, [selectedDestinationId]);

  // Effects
  useEffect(() => {
    if (id) {
      fetchTripDetails(id);
      fetchNoteStats(id);
    }
  }, [id, fetchTripDetails, fetchNoteStats]);

  // Fetch accommodations for all destinations (for trip-level warnings)
  useEffect(() => {
    if (selectedTrip?.destinations?.length > 0) {
      fetchAccommodationsForTrip(selectedTrip.destinations);
    }
  }, [selectedTrip?.destinations, fetchAccommodationsForTrip]);

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

  // Push rich destination context to AI store for contextual chat
  const flatPois = useMemo(() => {
    if (!pois || pois.length === 0) return [];
    return pois.flatMap((group) => group.pois || []);
  }, [pois]);

  useEffect(() => {
    if (!selectedDestinationId) {
      setDestinationContext(null);
      return;
    }

    const dest = selectedTrip?.destinations?.find(d => d.id === selectedDestinationId);
    if (!dest) return;

    const context = {
      id: dest.id,
      name: dest.city_name || dest.name,
      country: dest.country,
      arrivalDate: dest.arrival_date,
      departureDate: dest.departure_date,
      latitude: dest.latitude,
      longitude: dest.longitude,
      pois: flatPois.map(p => ({
        name: p.name,
        category: p.category,
        lat: p.latitude,
        lng: p.longitude,
        scheduledDate: p.scheduled_date,
        dayOrder: p.day_order,
        dwellTime: p.dwell_time,
        estimatedCost: p.estimated_cost,
        currency: p.currency,
      })),
      accommodations: accommodations?.map(a => ({
        name: a.name,
        type: a.type,
        address: a.address,
        lat: a.latitude,
        lng: a.longitude,
        checkIn: a.check_in_date,
        checkOut: a.check_out_date,
      })) || [],
    };

    setDestinationContext(context);
  }, [selectedDestinationId, flatPois.length, accommodations?.length]);

  // Clear destination context on unmount
  useEffect(() => {
    return () => setDestinationContext(null);
  }, []);

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
                <MapPlaceholder className="h-full rounded-xl shadow-inner border border-gray-200 dark:border-gray-700" />
             </div>
         </div>
      </div>
    );
  }

  if (!selectedTrip) {
    return <div className="flex items-center justify-center h-screen text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900">{t('trips.tripNotFound')}</div>;
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
        <div className="flex-1 flex justify-center min-w-0 mx-2 sm:mx-4">
          <div className="bg-gray-50 dark:bg-gray-700 px-2 sm:px-4 py-1.5 rounded-lg max-w-full overflow-hidden">
            <Breadcrumbs className="mb-0" />
          </div>
        </div>

        {/* Right: Collaboration, Activity, Journal, Calendar & Vault Toggles */}
        <div className="flex items-center gap-2">
          {isAuthenticated && <PresenceBar />}
          {isAuthenticated && (
            <button
              onClick={() => setShowMembersPanel(prev => !prev)}
              className={`p-2 rounded-lg transition-colors ${showMembersPanel ? 'bg-amber-50 dark:bg-amber-900/20 text-[#D97706] dark:text-amber-300' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              aria-label={t('collaboration.members')}
              title={t('collaboration.members')}
            >
              <Users className="w-5 h-5" />
            </button>
          )}
          {isAuthenticated && (
            <button
              onClick={() => setShowActivityPanel(prev => !prev)}
              className={`p-2 rounded-lg transition-colors ${showActivityPanel ? 'bg-amber-50 dark:bg-amber-900/20 text-[#D97706] dark:text-amber-300' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              aria-label={t('activity.title')}
              title={t('activity.title')}
            >
              <Activity className="w-5 h-5" />
            </button>
          )}
          <JournalToggle onClick={toggleJournal} noteCount={noteStats?.total_notes || 0} />
          <CalendarViewToggle onClick={toggleCalendar} isActive={isCalendarVisible} />
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
              trip={selectedTrip}
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
              accommodationsByDestination={accommodationsByDestination}
            />
          ) : isLeftPanelLoading ? (
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
                  onAddDayNote={handleAddDayNoteFromSchedule}
                  onAddPOINote={handleAddPOINoteFromSchedule}
                  className="h-full"
                />
              </div>

              {/* Accommodation Section with Timeline */}
              <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex-shrink-0 w-full">
                <AccommodationTimeline
                  className="w-full"
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
              tripLocation={tripLocation}
              enableAddDestination={true}
              onAddDestination={handleAddDestinationFromMap}
              originPoint={originPoint}
              returnPoint={returnPoint}
            />
          ) : !isMapReady ? (
            // Only show placeholder if we don't have destination coordinates yet
            <MapPlaceholder height="100%" />
          ) : (
            // Map renders immediately, data loads progressively
            <div className="relative h-full">
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
              {/* Loading overlay for POIs/Accommodations - map stays visible */}
              {isDataOverlayLoading && (
                <div className="absolute inset-0 bg-white/30 dark:bg-gray-900/30 backdrop-blur-[1px] flex items-center justify-center pointer-events-none z-10 transition-opacity duration-300">
                  <div className="bg-white dark:bg-gray-800 rounded-xl px-4 py-3 shadow-lg flex items-center gap-3">
                    <Spinner className="w-5 h-5 text-[#D97706] dark:text-amber-400" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Loading places...</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Document Vault Drawer */}
      <DocumentVault
        tripId={Number(id)}
        isOpen={isVaultVisible}
        onClose={toggleVault}
      />

      {/* Journal Drawer */}
      <Journal
        tripId={Number(id)}
        destinations={selectedTrip?.destinations || []}
        pois={pois}
        isOpen={isJournalVisible}
        onClose={toggleJournal}
      />

      {/* Members Panel */}
      {showMembersPanel && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowMembersPanel(false)} />
          <div className="absolute right-0 top-0 h-full w-80 bg-white dark:bg-gray-800 shadow-2xl transform transition-transform duration-200 ease-in-out overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('collaboration.members')}</h2>
              <button
                onClick={() => setShowMembersPanel(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <XIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <TripMemberList tripId={Number(id)} />
              <button
                onClick={() => setShowInviteModal(true)}
                className="w-full px-4 py-2 text-sm bg-[#D97706] text-white rounded-lg hover:bg-[#B45309] transition-colors"
              >
                {t('collaboration.invite')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activity Panel */}
      {showActivityPanel && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowActivityPanel(false)} />
          <div className="absolute right-0 top-0 h-full w-80 bg-white dark:bg-gray-800 shadow-2xl transform transition-transform duration-200 ease-in-out overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('activity.title')}</h2>
              <button
                onClick={() => setShowActivityPanel(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <XIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <div className="p-4 space-y-6">
              <ActivityFeed tripId={Number(id)} />
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <CommentThread tripId={Number(id)} entityType="trip" entityId={Number(id)} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      <InviteMemberModal
        tripId={Number(id)}
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
      />

      {/* Calendar View Panel */}
      {isCalendarVisible && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={toggleCalendar} />
          <div
            className={`
              absolute right-0 top-0 h-full w-full md:w-4/5 lg:w-3/4 xl:w-2/3
              bg-white dark:bg-gray-800 shadow-2xl
              ${isCalendarVisible ? calendarAnimationClasses.visible : calendarAnimationClasses.hidden}
              ${calendarAnimationClasses.transition}
            `}
          >
            <CalendarView
              trip={selectedTrip}
              destinations={selectedTrip?.destinations || []}
              pois={pois}
              accommodations={accommodations}
            />
          </div>
        </div>
      )}

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

      {/* Destination Form Modal */}
      <DestinationFormModal
        isOpen={showDestinationModal}
        onClose={() => {
          setShowDestinationModal(false);
          setEditingDestination(null);
          setDestinationPreFilledLocation(null);
        }}
        tripId={Number(id)}
        destination={editingDestination}
        onSuccess={() => fetchTripDetails(id)}
        trip={selectedTrip}
        preFilledLocation={destinationPreFilledLocation}
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

      {/* Note Form Modal (Quick-add from daily schedule) */}
      <NoteFormModal
        isOpen={showNoteFormModal}
        onClose={() => {
          setShowNoteFormModal(false);
          setNoteFormPreFill(null);
        }}
        onSubmit={async (noteData) => {
          const { createNote, fetchTripNotesGrouped } = useNoteStore.getState();
          await createNote(Number(id), noteData);
          setShowNoteFormModal(false);
          setNoteFormPreFill(null);
          // Refresh note stats
          fetchNoteStats(Number(id));
        }}
        tripId={Number(id)}
        destinations={selectedTrip?.destinations || []}
        pois={pois}
        preselectedDestinationId={noteFormPreFill?.destination_id}
        preselectedDayNumber={noteFormPreFill?.day_number}
        preselectedPoiId={noteFormPreFill?.poi_id}
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
