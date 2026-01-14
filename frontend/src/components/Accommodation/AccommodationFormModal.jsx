import React, { useState, useEffect } from 'react';
import { X, Bed } from 'lucide-react';
import useAccommodationStore from '../../stores/useAccommodationStore';

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
    { value: 'other', label: 'Other' },
  ];

  const amenityOptions = [
    'WiFi', 'Breakfast', 'Parking', 'Pool', 'Gym', 'AC',
    'Kitchen', 'Laundry', 'Pet Friendly', 'Airport Shuttle',
  ];

  const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'NOK', 'SEK', 'DKK'];

  useEffect(() => {
    if (accommodation) {
      setFormData({
        name: accommodation.name || '',
        type: accommodation.type || 'hotel',
        address: accommodation.address || '',
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      const accommodationData = {
        ...formData,
        destination_id: destinationId,
        total_cost: formData.total_cost ? parseFloat(formData.total_cost) : null,
        rating: formData.rating ? parseFloat(formData.rating) : null,
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
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-2">
            <Bed className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-semibold">
              {isEditMode ? 'Edit Accommodation' : 'Add Accommodation'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Name & Type */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium mb-1">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg ${errors.name ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="e.g., Hotel Nyhavn"
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium mb-1">Type *</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                {accommodationTypes.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium mb-1">Address</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="123 Main St, City"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Check-in *</label>
              <input
                type="date"
                value={formData.check_in_date}
                onChange={(e) => setFormData({ ...formData, check_in_date: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg ${errors.check_in_date ? 'border-red-500' : 'border-gray-300'}`}
              />
              {errors.check_in_date && <p className="text-red-500 text-xs mt-1">{errors.check_in_date}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Check-out *</label>
              <input
                type="date"
                value={formData.check_out_date}
                onChange={(e) => setFormData({ ...formData, check_out_date: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg ${errors.check_out_date ? 'border-red-500' : 'border-gray-300'}`}
              />
              {errors.check_out_date && <p className="text-red-500 text-xs mt-1">{errors.check_out_date}</p>}
            </div>
          </div>

          {/* Booking Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Booking Ref</label>
              <input
                type="text"
                value={formData.booking_reference}
                onChange={(e) => setFormData({ ...formData, booking_reference: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="ABC123"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Booking URL</label>
              <input
                type="url"
                value={formData.booking_url}
                onChange={(e) => setFormData({ ...formData, booking_url: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="https://..."
              />
            </div>
          </div>

          {/* Cost & Payment */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Total Cost</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.total_cost}
                onChange={(e) => setFormData({ ...formData, total_cost: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Currency</label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
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
                <span className="text-sm">Paid</span>
              </label>
            </div>
          </div>

          {/* Amenities */}
          <div>
            <label className="block text-sm font-medium mb-2">Amenities</label>
            <div className="flex flex-wrap gap-2">
              {amenityOptions.map((amenity) => (
                <button
                  key={amenity}
                  type="button"
                  onClick={() => handleAmenityToggle(amenity)}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    formData.amenities.includes(amenity)
                      ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {amenity}
                </button>
              ))}
            </div>
          </div>

          {/* Rating */}
          <div>
            <label className="block text-sm font-medium mb-1">Rating (1-5)</label>
            <input
              type="number"
              min="1"
              max="5"
              step="0.1"
              value={formData.rating}
              onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
              className={`w-24 px-3 py-2 border rounded-lg ${errors.rating ? 'border-red-500' : 'border-gray-300'}`}
              placeholder="4.5"
            />
            {errors.rating && <p className="text-red-500 text-xs mt-1">{errors.rating}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              rows={3}
              placeholder="Additional notes about this accommodation..."
            />
          </div>

          {/* Error */}
          {errors.submit && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{errors.submit}</div>
          )}

          {/* Buttons */}
          <div className="flex space-x-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={isLoading} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {isLoading ? 'Saving...' : isEditMode ? 'Save Changes' : 'Add Accommodation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AccommodationFormModal;
