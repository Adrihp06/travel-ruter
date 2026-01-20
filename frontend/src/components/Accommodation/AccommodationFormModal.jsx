import React, { useState, useEffect } from 'react';
import { X, Bed } from 'lucide-react';
import useAccommodationStore from '../../stores/useAccommodationStore';
import LocationAutocomplete from '../Location/LocationAutocomplete';
import DateRangePicker from '../common/DateRangePicker';

const AccommodationFormModal = ({
  isOpen,
  onClose,
  destinationId,
  accommodation = null,
  onSuccess,
}) => {
  const { createAccommodation, updateAccommodation, isLoading } = useAccommodationStore();
  const isEditMode = !!accommodation;

  const [formData, setFormData] = useState({
    name: '',
    type: 'hotel',
    address: '',
    latitude: null,
    longitude: null,
    check_in_date: '',
    check_out_date: '',
    booking_reference: '',
    booking_url: '',
    total_cost: '',
    currency: 'USD',
    is_paid: false,
    amenities: [],
    rating: '',
    description: '',
  });

  const [errors, setErrors] = useState({});

  const accommodationTypes = [
    { value: 'hotel', label: 'Hotel' },
    { value: 'hostel', label: 'Hostel' },
    { value: 'airbnb', label: 'Airbnb / Vacation Rental' },
    { value: 'apartment', label: 'Apartment' },
    { value: 'resort', label: 'Resort' },
    { value: 'camping', label: 'Camping' },
    { value: 'guesthouse', label: 'Guesthouse' },
    { value: 'ryokan', label: 'Ryokan' },
    { value: 'other', label: 'Other' },
  ];

  const amenityOptions = [
    'WiFi', 'Breakfast', 'Parking', 'Pool', 'Gym', 'AC',
    'Kitchen', 'Laundry', 'Pet Friendly', 'Airport Shuttle',
  ];

  const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'NOK', 'SEK', 'DKK'];

  // Populate form for edit mode
  useEffect(() => {
    if (accommodation) {
      setFormData({
        name: accommodation.name || '',
        type: accommodation.type || 'hotel',
        address: accommodation.address || '',
        latitude: accommodation.latitude || null,
        longitude: accommodation.longitude || null,
        check_in_date: accommodation.check_in_date || '',
        check_out_date: accommodation.check_out_date || '',
        booking_reference: accommodation.booking_reference || '',
        booking_url: accommodation.booking_url || '',
        total_cost: accommodation.total_cost || '',
        currency: accommodation.currency || 'USD',
        is_paid: accommodation.is_paid || false,
        amenities: accommodation.amenities || [],
        rating: accommodation.rating || '',
        description: accommodation.description || '',
      });
    } else {
      setFormData({
        name: '',
        type: 'hotel',
        address: '',
        latitude: null,
        longitude: null,
        check_in_date: '',
        check_out_date: '',
        booking_reference: '',
        booking_url: '',
        total_cost: '',
        currency: 'USD',
        is_paid: false,
        amenities: [],
        rating: '',
        description: '',
      });
    }
    setErrors({});
  }, [accommodation, isOpen]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Accommodation name is required';
    }

    if (!formData.check_in_date) {
      newErrors.check_in_date = 'Check-in date is required';
    }

    if (!formData.check_out_date) {
      newErrors.check_out_date = 'Check-out date is required';
    }

    if (formData.check_in_date && formData.check_out_date) {
      if (new Date(formData.check_out_date) <= new Date(formData.check_in_date)) {
        newErrors.check_out_date = 'Check-out must be after check-in';
      }
    }

    if (formData.rating && (formData.rating < 1 || formData.rating > 5)) {
      newErrors.rating = 'Rating must be between 1 and 5';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAmenityToggle = (amenity) => {
    setFormData((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter((a) => a !== amenity)
        : [...prev.amenities, amenity],
    }));
  };

  // Handle location selection from autocomplete
  const handleLocationChange = (address, latitude, longitude) => {
    setFormData((prev) => ({
      ...prev,
      address: address,
      latitude: latitude,
      longitude: longitude,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      const accommodationData = {
        ...formData,
        destination_id: destinationId,
        total_cost: formData.total_cost ? parseFloat(formData.total_cost) : null,
        rating: formData.rating ? parseFloat(formData.rating) : null,
        latitude: formData.latitude,
        longitude: formData.longitude,
      };

      let result;
      if (isEditMode) {
        result = await updateAccommodation(accommodation.id, accommodationData);
      } else {
        result = await createAccommodation(accommodationData);
      }

      onSuccess?.(result);
      onClose();
    } catch (error) {
      setErrors({ submit: error.message });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <Bed className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {isEditMode ? 'Edit Accommodation' : 'Add Accommodation'}
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
          {/* Name & Type */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${errors.name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
                placeholder="e.g., Hotel Nyhavn"
              />
              {errors.name && <p className="text-red-500 dark:text-red-400 text-xs mt-1">{errors.name}</p>}
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type *</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {accommodationTypes.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Address with Geocoding */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address / Location</label>
            <LocationAutocomplete
              value={formData.address}
              latitude={formData.latitude}
              longitude={formData.longitude}
              onChange={handleLocationChange}
              placeholder="Search for hotel address..."
              className="[&_input]:dark:bg-gray-700 [&_input]:dark:text-white [&_input]:dark:border-gray-600"
            />
          </div>

          {/* Dates */}
          <DateRangePicker
            startDate={formData.check_in_date}
            endDate={formData.check_out_date}
            onStartChange={(date) => setFormData({ ...formData, check_in_date: date })}
            onEndChange={(date) => setFormData({ ...formData, check_out_date: date })}
            startLabel="Check-in"
            endLabel="Check-out"
            startError={errors.check_in_date}
            endError={errors.check_out_date}
            required
            showDuration
          />

          {/* Booking Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Booking Ref</label>
              <input
                type="text"
                value={formData.booking_reference}
                onChange={(e) => setFormData({ ...formData, booking_reference: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="ABC123"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Booking URL</label>
              <input
                type="url"
                value={formData.booking_url}
                onChange={(e) => setFormData({ ...formData, booking_url: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="https://..."
              />
            </div>
          </div>

          {/* Cost & Payment */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Total Cost</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.total_cost}
                onChange={(e) => setFormData({ ...formData, total_cost: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Currency</label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_paid}
                  onChange={(e) => setFormData({ ...formData, is_paid: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Paid</span>
              </label>
            </div>
          </div>

          {/* Amenities */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Amenities</label>
            <div className="flex flex-wrap gap-2">
              {amenityOptions.map((amenity) => (
                <button
                  key={amenity}
                  type="button"
                  onClick={() => handleAmenityToggle(amenity)}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    formData.amenities.includes(amenity)
                      ? 'bg-indigo-100 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                      : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                  }`}
                >
                  {amenity}
                </button>
              ))}
            </div>
          </div>

          {/* Rating */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rating (1-5)</label>
            <input
              type="number"
              min="1"
              max="5"
              step="0.1"
              value={formData.rating}
              onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
              className={`w-24 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${errors.rating ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
              placeholder="4.5"
            />
            {errors.rating && <p className="text-red-500 dark:text-red-400 text-xs mt-1">{errors.rating}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              rows={3}
              placeholder="Additional notes about this accommodation..."
            />
          </div>

          {/* Error */}
          {errors.submit && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm">{errors.submit}</div>
          )}

          {/* Buttons */}
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
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {isLoading ? 'Saving...' : isEditMode ? 'Save Changes' : 'Add Accommodation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AccommodationFormModal;
