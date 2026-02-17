import React, { useState, useEffect, useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Upload, Tag as TagIcon, MapPin, Car, Train, Bus, Footprints, Bike, Ship } from 'lucide-react';
import XIcon from '@/components/icons/x-icon';
import AirplaneIcon from '@/components/icons/airplane-icon';
import HomeIcon from '@/components/icons/home-icon';
import useTripStore from '../../stores/useTripStore';
import authFetch from '../../utils/authFetch';
import LocationAutocomplete from '../Location/LocationAutocomplete';
import LocationMapPreview from '../Location/LocationMapPreview';
import DateRangePicker from '../common/DateRangePicker';
import Spinner from '../UI/Spinner';


const TripFormModal = ({ isOpen, onClose, trip = null, onSuccess }) => {
  const { t } = useTranslation();
  const { createTrip, updateTrip, isLoading } = useTripStore();
  const isEditMode = !!trip;
  const titleId = useId();

  const TRAVEL_MODE_OPTIONS = useMemo(() => [
    { value: 'plane', label: t('trips.travelModes.plane'), icon: AirplaneIcon },
    { value: 'car', label: t('trips.travelModes.car'), icon: Car },
    { value: 'train', label: t('trips.travelModes.train'), icon: Train },
    { value: 'bus', label: t('trips.travelModes.bus'), icon: Bus },
    { value: 'walk', label: t('trips.travelModes.walk'), icon: Footprints },
    { value: 'bike', label: t('trips.travelModes.bike'), icon: Bike },
    { value: 'ferry', label: t('trips.travelModes.ferry'), icon: Ship },
  ], [t]);

  const AVAILABLE_TAGS = useMemo(() => [
    { id: 'business', label: t('trips.tags.business'), color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' },
    { id: 'vacation', label: t('trips.tags.vacation'), color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
    { id: 'adventure', label: t('trips.tags.adventure'), color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300' },
    { id: 'romantic', label: t('trips.tags.romantic'), color: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300' },
    { id: 'family', label: t('trips.tags.family'), color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' },
    { id: 'solo', label: t('trips.tags.solo'), color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' },
    { id: 'cultural', label: t('trips.tags.cultural'), color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300' },
    { id: 'beach', label: t('trips.tags.beach'), color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300' },
  ], [t]);

  const [formData, setFormData] = useState({
    name: '',
    location: '',
    latitude: null,
    longitude: null,
    description: '',
    cover_image: '',
    start_date: '',
    end_date: '',
    total_budget: '',
    currency: 'USD',
    status: 'planning',
    tags: [],
    // Origin and return points
    origin_name: '',
    origin_latitude: null,
    origin_longitude: null,
    origin_travel_mode: 'plane',
    return_name: '',
    return_latitude: null,
    return_longitude: null,
    return_travel_mode: 'plane',
  });
  const [returnSameAsOrigin, setReturnSameAsOrigin] = useState(true);

  const [errors, setErrors] = useState({});
  const [imageUploadMode, setImageUploadMode] = useState('url'); // 'url' or 'file'
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // Populate form for edit mode
  useEffect(() => {
    if (trip) {
      setFormData({
        name: trip.name || '',
        location: trip.location || '',
        latitude: trip.latitude || null,
        longitude: trip.longitude || null,
        description: trip.description || '',
        cover_image: trip.cover_image || '',
        start_date: trip.start_date || '',
        end_date: trip.end_date || '',
        total_budget: trip.total_budget || '',
        currency: trip.currency || 'USD',
        status: trip.status || 'planning',
        tags: trip.tags || [],
        // Origin and return points
        origin_name: trip.origin_name || '',
        origin_latitude: trip.origin_latitude || null,
        origin_longitude: trip.origin_longitude || null,
        origin_travel_mode: trip.origin_travel_mode || 'plane',
        return_name: trip.return_name || '',
        return_latitude: trip.return_latitude || null,
        return_longitude: trip.return_longitude || null,
        return_travel_mode: trip.return_travel_mode || 'plane',
      });
      // Determine if return is same as origin
      const hasReturnDifferentFromOrigin = trip.return_name && trip.return_name !== trip.origin_name;
      setReturnSameAsOrigin(!hasReturnDifferentFromOrigin);
      // Reset image upload state
      setImageUploadMode('url');
      setImageFile(null);
      setImagePreview(null);
    } else {
      // Reset form for create mode
      setFormData({
        name: '',
        location: '',
        latitude: null,
        longitude: null,
        description: '',
        cover_image: '',
        start_date: '',
        end_date: '',
        total_budget: '',
        currency: 'USD',
        status: 'planning',
        tags: [],
        // Origin and return points
        origin_name: '',
        origin_latitude: null,
        origin_longitude: null,
        origin_travel_mode: 'plane',
        return_name: '',
        return_latitude: null,
        return_longitude: null,
        return_travel_mode: 'plane',
      });
      setReturnSameAsOrigin(true);
      setImageUploadMode('url');
      setImageFile(null);
      setImagePreview(null);
    }
  }, [trip, isOpen]);

  // Track active FileReader for cleanup
  const fileReaderRef = React.useRef(null);

  // Cleanup FileReader on unmount
  useEffect(() => {
    return () => {
      if (fileReaderRef.current) {
        fileReaderRef.current.abort();
        fileReaderRef.current = null;
      }
    };
  }, []);

  // Handle file selection for cover image
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setErrors({ ...errors, cover_image: t('trips.selectImageFile') });
        return;
      }
      // Validate file size (5MB max for images)
      if (file.size > 5 * 1024 * 1024) {
        setErrors({ ...errors, cover_image: t('trips.imageTooLarge') });
        return;
      }
      setImageFile(file);
      setErrors({ ...errors, cover_image: undefined });
      // Abort any previous reader
      if (fileReaderRef.current) {
        fileReaderRef.current.abort();
      }
      // Create preview
      const reader = new FileReader();
      fileReaderRef.current = reader;
      reader.onloadend = () => {
        if (fileReaderRef.current === reader) {
          setImagePreview(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Toggle tag selection
  const toggleTag = (tagId) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tagId)
        ? prev.tags.filter(t => t !== tagId)
        : [...prev.tags, tagId]
    }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = t('trips.tripNameRequired');
    }

    if (!formData.start_date) {
      newErrors.start_date = t('trips.startDateRequired');
    }

    if (!formData.end_date) {
      newErrors.end_date = t('trips.endDateRequired');
    }

    if (formData.start_date && formData.end_date) {
      if (new Date(formData.end_date) < new Date(formData.start_date)) {
        newErrors.end_date = t('trips.endAfterStart');
      }
    }

    if (formData.total_budget !== '' && Number(formData.total_budget) < 0) {
      newErrors.total_budget = t('trips.budgetNegative');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setIsUploading(true);

      let coverImageUrl = formData.cover_image || null;

      // If file upload mode and file selected, upload first
      if (imageUploadMode === 'file' && imageFile) {
        const formDataUpload = new FormData();
        formDataUpload.append('file', imageFile);

        const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
        const uploadResponse = await authFetch(`${API_BASE_URL}/trips/upload-cover`, {
          method: 'POST',
          body: formDataUpload,
        });

        if (!uploadResponse.ok) {
          throw new Error(t('trips.failedUploadCover'));
        }

        const uploadResult = await uploadResponse.json();
        coverImageUrl = uploadResult.url;
      }

      // If return is same as origin, copy origin values to return (with null safety)
      const returnName = returnSameAsOrigin && formData.origin_name
        ? formData.origin_name : formData.return_name;
      const returnLat = returnSameAsOrigin && formData.origin_latitude !== null
        ? formData.origin_latitude : formData.return_latitude;
      const returnLng = returnSameAsOrigin && formData.origin_longitude !== null
        ? formData.origin_longitude : formData.return_longitude;

      const tripData = {
        ...formData,
        total_budget: formData.total_budget ? Number(formData.total_budget) : null,
        cover_image: coverImageUrl,
        // Set return to same as origin if checkbox is checked
        return_name: returnName || null,
        return_latitude: returnLat,
        return_longitude: returnLng,
        // Travel modes for origin/return segments
        origin_travel_mode: formData.origin_travel_mode || 'plane',
        return_travel_mode: formData.return_travel_mode || 'plane',
      };

      let result;
      if (isEditMode) {
        result = await updateTrip(trip.id, tripData);
      } else {
        result = await createTrip(tripData);
      }

      onSuccess?.(result);
      onClose();
    } catch (error) {
      setErrors({ submit: error.message });
    } finally {
      setIsUploading(false);
    }
  };

  const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'NOK', 'SEK', 'DKK'];
  const statuses = [
    { value: 'planning', label: t('trips.planning') },
    { value: 'booked', label: t('trips.booked') },
    { value: 'completed', label: t('trips.completed') },
    { value: 'cancelled', label: t('trips.cancelled') },
  ];

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 modal-backdrop flex items-center justify-center z-50 p-4"
      role="presentation"
    >
      <div
        className="modal-content bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col border border-gray-200/50 dark:border-gray-700/50"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        {/* Header */}
        <div className="modal-header flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="modal-icon-container primary">
              <AirplaneIcon className="w-5 h-5 text-[#D97706] dark:text-amber-400" />
            </div>
            <div>
              <h3 id={titleId} className="text-lg font-bold text-gray-900 dark:text-white">
                {isEditMode ? t('trips.editTrip') : t('trips.createTrip')}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {isEditMode ? t('trips.updateDetails') : t('trips.planNextAdventure')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="modal-close-btn p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Close modal"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-5">
            {/* Trip Name */}
            <div>
              <label className="modal-label">
                {t('trips.tripName')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={`modal-input w-full px-4 py-2.5 rounded-xl text-gray-900 dark:text-white bg-white dark:bg-gray-700 ${
                  errors.name ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''
                }`}
                placeholder={t('trips.tripNamePlaceholder')}
              />
              {errors.name && (
                <p className="text-red-500 dark:text-red-400 text-xs mt-1.5 flex items-center gap-1">
                  <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                  {errors.name}
                </p>
              )}
            </div>

          {/* Location */}
          <div>
            <label className="modal-label">
              <MapPin className="w-4 h-4" />
              {t('trips.destination')}
            </label>
            <LocationAutocomplete
              value={formData.location}
              latitude={formData.latitude}
              longitude={formData.longitude}
              onChange={(location, lat, lng) => {
                setFormData({
                  ...formData,
                  location,
                  latitude: lat,
                  longitude: lng,
                });
              }}
              placeholder={t('trips.searchLocation')}
            />
            {formData.latitude && formData.longitude && (
              <div className="mt-2">
                <LocationMapPreview
                  latitude={formData.latitude}
                  longitude={formData.longitude}
                  height={120}
                />
              </div>
            )}
          </div>

          {/* Departure Point (Origin) */}
          <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50/50 dark:from-green-900/20 dark:to-emerald-900/10 rounded-xl border border-green-200/70 dark:border-green-800/50">
            <label className="modal-label text-green-700 dark:text-green-400">
              <HomeIcon className="w-4 h-4" />
              {t('trips.departurePoint')}
            </label>
            <p className="text-xs text-green-600/70 dark:text-green-400/60 mb-3">
              {t('trips.departureDescription')}
            </p>
            <LocationAutocomplete
              value={formData.origin_name}
              latitude={formData.origin_latitude}
              longitude={formData.origin_longitude}
              onChange={(location, lat, lng) => {
                setFormData({
                  ...formData,
                  origin_name: location,
                  origin_latitude: lat,
                  origin_longitude: lng,
                });
              }}
              placeholder={t('trips.searchDeparture')}
            />
            {formData.origin_latitude && formData.origin_longitude && (
              <div className="mt-2">
                <LocationMapPreview
                  latitude={formData.origin_latitude}
                  longitude={formData.origin_longitude}
                  height={100}
                />
              </div>
            )}
            {/* Travel mode selector */}
            <div className="mt-3">
              <label className="text-xs font-medium text-green-700/80 dark:text-green-400/70 mb-2 block">
                {t('trips.travelToFirst')}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {TRAVEL_MODE_OPTIONS.map((mode) => {
                  const Icon = mode.icon;
                  const isSelected = formData.origin_travel_mode === mode.value;
                  return (
                    <button
                      key={mode.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, origin_travel_mode: mode.value })}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        isSelected
                          ? 'bg-green-600 text-white shadow-sm scale-105'
                          : 'bg-white/70 dark:bg-gray-700/50 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/30'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {mode.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Return Point */}
          <div className="p-4 bg-gradient-to-br from-rose-50 to-red-50/50 dark:from-red-900/20 dark:to-rose-900/10 rounded-xl border border-red-200/70 dark:border-red-800/50">
            <label className="modal-label text-red-700 dark:text-red-400">
              <MapPin className="w-4 h-4" />
              {t('trips.returnPoint')}
            </label>

            {/* Checkbox for same location */}
            <label className="flex items-center gap-2.5 mb-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={returnSameAsOrigin}
                onChange={(e) => {
                  setReturnSameAsOrigin(e.target.checked);
                  if (e.target.checked) {
                    // Clear return fields when checking "same as origin"
                    setFormData({
                      ...formData,
                      return_name: '',
                      return_latitude: null,
                      return_longitude: null,
                    });
                  }
                }}
                className="w-4 h-4 rounded border-gray-300 text-[#D97706] focus:ring-[#D97706]/50 focus:ring-offset-0"
              />
              <span className="text-sm text-red-600/80 dark:text-red-400/70 group-hover:text-red-700 dark:group-hover:text-red-300 transition-colors">
                {t('trips.returnSameAsDeparture')}
              </span>
            </label>

            {!returnSameAsOrigin && (
              <>
                <p className="text-xs text-red-600/60 dark:text-red-400/50 mb-3">
                  {t('trips.returnDescription')}
                </p>
                <LocationAutocomplete
                  value={formData.return_name}
                  latitude={formData.return_latitude}
                  longitude={formData.return_longitude}
                  onChange={(location, lat, lng) => {
                    setFormData({
                      ...formData,
                      return_name: location,
                      return_latitude: lat,
                      return_longitude: lng,
                    });
                  }}
                  placeholder={t('trips.searchReturn')}
                />
                {formData.return_latitude && formData.return_longitude && (
                  <div className="mt-2">
                    <LocationMapPreview
                      latitude={formData.return_latitude}
                      longitude={formData.return_longitude}
                      height={100}
                    />
                  </div>
                )}
              </>
            )}

            {/* Travel mode selector */}
            <div className="mt-3">
              <label className="text-xs font-medium text-red-700/80 dark:text-red-400/70 mb-2 block">
                {t('trips.travelFromLast')}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {TRAVEL_MODE_OPTIONS.map((mode) => {
                  const Icon = mode.icon;
                  const isSelected = formData.return_travel_mode === mode.value;
                  return (
                    <button
                      key={mode.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, return_travel_mode: mode.value })}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        isSelected
                          ? 'bg-red-600 text-white shadow-sm scale-105'
                          : 'bg-white/70 dark:bg-gray-700/50 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {mode.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="modal-section">
            <label className="modal-label">
              {t('common.description')}
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="modal-input w-full px-4 py-2.5 rounded-xl text-gray-900 dark:text-white bg-white dark:bg-gray-700 resize-none"
              rows={3}
              placeholder={t('common.description')}
            />
          </div>

          {/* Cover Image */}
          <div>
            <label className="modal-label">
              <Image className="w-4 h-4" />
              {t('trips.coverImage')}
            </label>

            {/* Toggle between URL and File upload */}
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setImageUploadMode('url')}
                className={`flex-1 px-3 py-2 text-sm rounded-xl font-medium transition-all ${
                  imageUploadMode === 'url'
                    ? 'bg-amber-100 text-[#D97706] dark:bg-amber-900/30 dark:text-amber-300 ring-2 ring-amber-500/30'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                URL
              </button>
              <button
                type="button"
                onClick={() => setImageUploadMode('file')}
                className={`flex-1 px-3 py-2 text-sm rounded-xl font-medium transition-all flex items-center justify-center gap-1.5 ${
                  imageUploadMode === 'file'
                    ? 'bg-amber-100 text-[#D97706] dark:bg-amber-900/30 dark:text-amber-300 ring-2 ring-amber-500/30'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                {t('common.upload')}
              </button>
            </div>

            {imageUploadMode === 'url' ? (
              <>
                <input
                  type="url"
                  value={formData.cover_image}
                  onChange={(e) => setFormData({ ...formData, cover_image: e.target.value })}
                  className="modal-input w-full px-4 py-2.5 rounded-xl text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  placeholder="https://example.com/image.jpg"
                />
                {formData.cover_image && (
                  <div className="mt-3 rounded-xl overflow-hidden h-28 ring-1 ring-gray-200 dark:ring-gray-700">
                    <img
                      src={formData.cover_image}
                      alt="Cover preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        setErrors(prev => ({ ...prev, cover_image_preview: t('trips.failedLoadPreview') }));
                      }}
                    />
                  </div>
                )}
                {errors.cover_image_preview && (
                  <p className="text-amber-500 dark:text-amber-400 text-xs mt-1.5 flex items-center gap-1">
                    <span className="w-1 h-1 bg-amber-500 rounded-full"></span>
                    {errors.cover_image_preview}
                  </p>
                )}
              </>
            ) : (
              <>
                <div
                  className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all hover:scale-[1.01] ${
                    imageFile
                      ? 'border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-900/20'
                      : 'border-gray-300 dark:border-gray-600 hover:border-amber-400 dark:hover:border-[#D97706] hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                  onClick={() => document.getElementById('cover-image-input').click()}
                >
                  <input
                    id="cover-image-input"
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  {imagePreview ? (
                    <div className="space-y-3">
                      <img
                        src={imagePreview}
                        alt="Cover preview"
                        className="mx-auto h-24 object-cover rounded-lg ring-1 ring-gray-200 dark:ring-gray-700"
                      />
                      <p className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-xs mx-auto">
                        {imageFile?.name}
                      </p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setImageFile(null);
                          setImagePreview(null);
                        }}
                        className="text-xs text-red-500 hover:text-red-600 font-medium px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        {t('common.remove')}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="w-12 h-12 mx-auto bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center">
                        <Upload className="w-6 h-6 text-gray-400" />
                      </div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        {t('trips.clickToUpload')}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {t('trips.imageFormats')}
                      </p>
                    </div>
                  )}
                </div>
                {errors.cover_image && (
                  <p className="text-red-500 dark:text-red-400 text-xs mt-1.5">{errors.cover_image}</p>
                )}
              </>
            )}
            <p className="modal-helper">
              {t('trips.coverImageHelper')}
            </p>
          </div>

          {/* Dates */}
          <DateRangePicker
            startDate={formData.start_date}
            endDate={formData.end_date}
            onStartChange={(date) => setFormData({ ...formData, start_date: date })}
            onEndChange={(date) => setFormData({ ...formData, end_date: date })}
            startLabel={t('trips.startDate')}
            endLabel={t('trips.endDate')}
            startError={errors.start_date}
            endError={errors.end_date}
            required
            showDuration
          />

          {/* Tags / Categories */}
          <div className="modal-section">
            <label className="modal-label">
              <TagIcon className="w-4 h-4" />
              {t('trips.tripTags')}
            </label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_TAGS.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-all ${
                    formData.tags.includes(tag.id)
                      ? `${tag.color} ring-2 ring-offset-1 ring-[#D97706] dark:ring-offset-gray-800 scale-105`
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 hover:scale-105'
                  }`}
                >
                  {tag.label}
                </button>
              ))}
            </div>
            <p className="modal-helper">
              {t('trips.selectTags')}
            </p>
          </div>

          {/* Budget */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="modal-label">
                {t('trips.budgetField')}
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.total_budget}
                onChange={(e) => setFormData({ ...formData, total_budget: e.target.value })}
                className="modal-input w-full px-4 py-2.5 rounded-xl text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="modal-label">
                {t('trips.currency')}
              </label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="modal-input w-full px-4 py-2.5 rounded-xl text-gray-900 dark:text-white bg-white dark:bg-gray-700 cursor-pointer"
              >
                {currencies.map((curr) => (
                  <option key={curr} value={curr}>{curr}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Status (edit mode only) */}
          {isEditMode && (
            <div>
              <label className="modal-label">
                {t('common.status')}
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="modal-input w-full px-4 py-2.5 rounded-xl text-gray-900 dark:text-white bg-white dark:bg-gray-700 cursor-pointer"
              >
                {statuses.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Error Message */}
          {errors.submit && (
            <div className="modal-error">
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>{errors.submit}</span>
            </div>
          )}
          </div>

          {/* Footer with Buttons */}
          <div className="flex gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
            <button
              type="button"
              onClick={onClose}
              className="modal-btn modal-btn-secondary flex-1"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isLoading || isUploading}
              className="modal-btn modal-btn-primary flex-1"
            >
              {(isLoading || isUploading) && <span className="modal-spinner" />}
              <span>
                {isUploading ? t('common.uploading') : isLoading ? t('common.saving') : isEditMode ? t('trips.saveChanges') : t('trips.createTrip')}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TripFormModal;
