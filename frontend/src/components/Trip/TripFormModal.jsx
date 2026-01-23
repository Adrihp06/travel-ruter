import React, { useState, useEffect } from 'react';
import { X, Plane, Image, Upload, Tag as TagIcon, Home, MapPin } from 'lucide-react';
import useTripStore from '../../stores/useTripStore';
import LocationAutocomplete from '../Location/LocationAutocomplete';
import LocationMapPreview from '../Location/LocationMapPreview';
import DateRangePicker from '../common/DateRangePicker';
import Spinner from '../UI/Spinner';

const AVAILABLE_TAGS = [
  { id: 'business', label: 'Business', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' },
  { id: 'vacation', label: 'Vacation', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
  { id: 'adventure', label: 'Adventure', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300' },
  { id: 'romantic', label: 'Romantic', color: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300' },
  { id: 'family', label: 'Family', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' },
  { id: 'solo', label: 'Solo', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' },
  { id: 'cultural', label: 'Cultural', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300' },
  { id: 'beach', label: 'Beach', color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300' },
];

const TripFormModal = ({ isOpen, onClose, trip = null, onSuccess }) => {
  const { createTrip, updateTrip, isLoading } = useTripStore();
  const isEditMode = !!trip;

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
    return_name: '',
    return_latitude: null,
    return_longitude: null,
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
        return_name: trip.return_name || '',
        return_latitude: trip.return_latitude || null,
        return_longitude: trip.return_longitude || null,
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
        return_name: '',
        return_latitude: null,
        return_longitude: null,
      });
      setReturnSameAsOrigin(true);
      setImageUploadMode('url');
      setImageFile(null);
      setImagePreview(null);
    }
  }, [trip, isOpen]);

  // Handle file selection for cover image
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setErrors({ ...errors, cover_image: 'Please select an image file' });
        return;
      }
      // Validate file size (5MB max for images)
      if (file.size > 5 * 1024 * 1024) {
        setErrors({ ...errors, cover_image: 'Image must be less than 5MB' });
        return;
      }
      setImageFile(file);
      setErrors({ ...errors, cover_image: undefined });
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
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
      newErrors.name = 'Trip name is required';
    }

    if (!formData.start_date) {
      newErrors.start_date = 'Start date is required';
    }

    if (!formData.end_date) {
      newErrors.end_date = 'End date is required';
    }

    if (formData.start_date && formData.end_date) {
      if (new Date(formData.end_date) < new Date(formData.start_date)) {
        newErrors.end_date = 'End date must be after start date';
      }
    }

    if (formData.total_budget && formData.total_budget < 0) {
      newErrors.total_budget = 'Budget cannot be negative';
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
        const uploadResponse = await fetch(`${API_BASE_URL}/trips/upload-cover`, {
          method: 'POST',
          body: formDataUpload,
        });

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload cover image');
        }

        const uploadResult = await uploadResponse.json();
        coverImageUrl = uploadResult.url;
      }

      // If return is same as origin, copy origin values to return
      const returnName = returnSameAsOrigin ? formData.origin_name : formData.return_name;
      const returnLat = returnSameAsOrigin ? formData.origin_latitude : formData.return_latitude;
      const returnLng = returnSameAsOrigin ? formData.origin_longitude : formData.return_longitude;

      const tripData = {
        ...formData,
        total_budget: formData.total_budget ? Number(formData.total_budget) : null,
        cover_image: coverImageUrl,
        // Set return to same as origin if checkbox is checked
        return_name: returnName || null,
        return_latitude: returnLat,
        return_longitude: returnLng,
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
    { value: 'planning', label: 'Planning' },
    { value: 'booked', label: 'Booked' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <Plane className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {isEditMode ? 'Edit Trip' : 'Create New Trip'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Trip Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Trip Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white bg-white dark:bg-gray-700 ${
                errors.name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="e.g., Japan Adventure 2026"
            />
            {errors.name && (
              <p className="text-red-500 dark:text-red-400 text-xs mt-1">{errors.name}</p>
            )}
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Location
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
              placeholder="Search for a location..."
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
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <span className="flex items-center">
                <Home className="w-4 h-4 mr-1.5 text-green-600 dark:text-green-400" />
                Departure Point
              </span>
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Where does your trip start? (e.g., home airport)
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
              placeholder="Search for departure airport or location..."
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
          </div>

          {/* Return Point */}
          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <span className="flex items-center">
                <MapPin className="w-4 h-4 mr-1.5 text-red-600 dark:text-red-400" />
                Return Point
              </span>
            </label>

            {/* Checkbox for same location */}
            <label className="flex items-center space-x-2 mb-2">
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
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Return to same location as departure
              </span>
            </label>

            {!returnSameAsOrigin && (
              <>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Where does your trip end?
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
                  placeholder="Search for return airport or location..."
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
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white bg-white dark:bg-gray-700"
              rows={3}
              placeholder="Brief description of your trip..."
            />
          </div>

          {/* Cover Image */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <span className="flex items-center">
                <Image className="w-4 h-4 mr-1.5" />
                Cover Image
              </span>
            </label>

            {/* Toggle between URL and File upload */}
            <div className="flex space-x-2 mb-2">
              <button
                type="button"
                onClick={() => setImageUploadMode('url')}
                className={`flex-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  imageUploadMode === 'url'
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                URL
              </button>
              <button
                type="button"
                onClick={() => setImageUploadMode('file')}
                className={`flex-1 px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center justify-center ${
                  imageUploadMode === 'file'
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <Upload className="w-3.5 h-3.5 mr-1" />
                Upload
              </button>
            </div>

            {imageUploadMode === 'url' ? (
              <>
                <input
                  type="url"
                  value={formData.cover_image}
                  onChange={(e) => setFormData({ ...formData, cover_image: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  placeholder="https://example.com/image.jpg"
                />
                {formData.cover_image && (
                  <div className="mt-2 rounded-lg overflow-hidden h-24">
                    <img
                      src={formData.cover_image}
                      alt="Cover preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </>
            ) : (
              <>
                <div
                  className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                    imageFile
                      ? 'border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-900/20'
                      : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-500'
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
                    <div className="space-y-2">
                      <img
                        src={imagePreview}
                        alt="Cover preview"
                        className="mx-auto h-20 object-cover rounded"
                      />
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {imageFile?.name}
                      </p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setImageFile(null);
                          setImagePreview(null);
                        }}
                        className="text-xs text-red-500 hover:text-red-600"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Upload className="w-8 h-8 mx-auto text-gray-400" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Click to upload an image
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        JPG, PNG up to 5MB
                      </p>
                    </div>
                  )}
                </div>
                {errors.cover_image && (
                  <p className="text-red-500 dark:text-red-400 text-xs mt-1">{errors.cover_image}</p>
                )}
              </>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Optional: Add a cover image for your trip card
            </p>
          </div>

          {/* Dates */}
          <DateRangePicker
            startDate={formData.start_date}
            endDate={formData.end_date}
            onStartChange={(date) => setFormData({ ...formData, start_date: date })}
            onEndChange={(date) => setFormData({ ...formData, end_date: date })}
            startLabel="Start Date"
            endLabel="End Date"
            startError={errors.start_date}
            endError={errors.end_date}
            required
            showDuration
          />

          {/* Tags / Categories */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <span className="flex items-center">
                <TagIcon className="w-4 h-4 mr-1.5" />
                Trip Tags
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_TAGS.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    formData.tags.includes(tag.id)
                      ? `${tag.color} ring-2 ring-offset-1 ring-indigo-500 dark:ring-offset-gray-800`
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {tag.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
              Select tags to categorize your trip
            </p>
          </div>

          {/* Budget */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Budget
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.total_budget}
                onChange={(e) => setFormData({ ...formData, total_budget: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Currency
              </label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white bg-white dark:bg-gray-700"
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white bg-white dark:bg-gray-700"
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
            <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm">
              {errors.submit}
            </div>
          )}

          {/* Buttons */}
          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || isUploading}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {(isLoading || isUploading) && <Spinner className="text-white" />}
              <span>
                {isUploading ? 'Uploading...' : isLoading ? 'Saving...' : isEditMode ? 'Save Changes' : 'Create Trip'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TripFormModal;
