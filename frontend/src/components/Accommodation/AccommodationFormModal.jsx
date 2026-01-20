import React, { useState, useEffect, useMemo } from 'react';
import { X, Bed, Calendar } from 'lucide-react';
import useAccommodationStore from '../../stores/useAccommodationStore';
import LocationAutocomplete from '../Location/LocationAutocomplete';
import DateRangePicker from '../common/DateRangePicker';

const AccommodationFormModal = ({
  isOpen,
  onClose,
  destinationId,
  destination = null,
  accommodation = null,
  preFillDates = null,
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

  const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'NOK', 'SEK', 'DKK'];

  // Calculate which nights of the destination stay this accommodation covers
  const nightCoverage = useMemo(() => {
    if (!formData.check_in_date || !formData.check_out_date || !destination?.arrival_date || !destination?.departure_date) {
      return { nights: [], display: '' };
    }

    const destArrival = new Date(destination.arrival_date);
    const destDeparture = new Date(destination.departure_date);
    const checkInDate = new Date(formData.check_in_date);
    const checkOutDate = new Date(formData.check_out_date);

    const nights = [];
    let current = new Date(checkInDate);

    while (current < checkOutDate) {
      if (current >= destArrival && current < destDeparture) {
        const nightNum = Math.floor((current - destArrival) / (1000 * 60 * 60 * 24)) + 1;
        nights.push(nightNum);
      }
      current.setDate(current.getDate() + 1);
    }

    if (nights.length === 0) return { nights: [], display: '' };

    let display;
    if (nights.length === 1) {
      display = `Covers night ${nights[0]} of your stay`;
    } else if (nights[nights.length - 1] - nights[0] + 1 === nights.length) {
      display = `Covers nights ${nights[0]}-${nights[nights.length - 1]} of your stay`;
    } else {
      display = `Covers nights ${nights.join(', ')} of your stay`;
    }

    return { nights, display };
  }, [formData.check_in_date, formData.check_out_date, destination]);

  // Populate form for edit mode or set defaults
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
        description: accommodation.description || '',
      });
    } else {
      // For new accommodations, default to destination dates or preFillDates
      setFormData({
        name: '',
        type: 'hotel',
        address: '',
        latitude: null,
        longitude: null,
        check_in_date: preFillDates?.check_in_date || destination?.arrival_date || '',
        check_out_date: preFillDates?.check_out_date || destination?.departure_date || '',
        booking_reference: '',
        booking_url: '',
        total_cost: '',
        currency: 'USD',
        is_paid: false,
        description: '',
      });
    }
    setErrors({});
  }, [accommodation, isOpen, destination, preFillDates]);

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

    // Validate dates are within destination range
    if (destination && formData.check_in_date && formData.check_out_date) {
      const checkIn = new Date(formData.check_in_date);
      const checkOut = new Date(formData.check_out_date);
      const destArrival = new Date(destination.arrival_date);
      const destDeparture = new Date(destination.departure_date);

      if (checkIn < destArrival) {
        newErrors.check_in_date = 'Check-in cannot be before destination arrival';
      }
      if (checkOut > destDeparture) {
        newErrors.check_out_date = 'Check-out cannot be after destination departure';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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

          {/* Dates - Using DateRangePicker with min/max constraints */}
          <DateRangePicker
            startDate={formData.check_in_date}
            endDate={formData.check_out_date}
            onStartChange={(date) => setFormData({ ...formData, check_in_date: date })}
            onEndChange={(date) => setFormData({ ...formData, check_out_date: date })}
            startLabel="Check-in"
            endLabel="Check-out"
            startError={errors.check_in_date}
            endError={errors.check_out_date}
            minDate={destination?.arrival_date}
            maxDate={destination?.departure_date}
            required
            showDuration
          />

          {/* Night coverage indicator */}
          {nightCoverage.display && (
            <div className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-3 py-2 rounded-lg text-sm flex items-center">
              <Calendar className="w-4 h-4 mr-2" />
              <span>{nightCoverage.display}</span>
            </div>
          )}

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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Total Cost</label>
              <div className="flex">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.total_cost}
                  onChange={(e) => setFormData({ ...formData, total_cost: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-l-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="px-2 py-2 border border-l-0 border-gray-300 dark:border-gray-600 rounded-r-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Payment Status</label>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, is_paid: !formData.is_paid })}
                className={`w-full px-3 py-2 rounded-lg border transition-colors flex items-center justify-center space-x-2 ${
                  formData.is_paid
                    ? 'bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300'
                    : 'bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300'
                }`}
              >
                <span className={`w-3 h-3 rounded-full ${formData.is_paid ? 'bg-green-500' : 'bg-amber-500'}`} />
                <span>{formData.is_paid ? 'Paid' : 'Not Paid'}</span>
              </button>
            </div>
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
