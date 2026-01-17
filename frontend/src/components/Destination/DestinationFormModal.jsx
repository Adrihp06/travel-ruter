import React, { useState, useEffect } from 'react';
import { X, MapPin, Calendar } from 'lucide-react';
import useDestinationStore from '../../stores/useDestinationStore';

const DestinationFormModal = ({
  isOpen,
  onClose,
  tripId,
  destination = null,
  onSuccess,
  trip = null,
}) => {
  const { createDestination, updateDestination, isLoading } = useDestinationStore();
  const isEditMode = !!destination;

  const [formData, setFormData] = useState({
    city_name: '',
    country: '',
    arrival_date: '',
    departure_date: '',
    notes: '',
    latitude: '',
    longitude: '',
  });

  const [errors, setErrors] = useState({});

  // Calculate nights automatically
  const calculateNights = () => {
    if (formData.arrival_date && formData.departure_date) {
      const arrival = new Date(formData.arrival_date);
      const departure = new Date(formData.departure_date);
      const diff = Math.ceil((departure - arrival) / (1000 * 60 * 60 * 24));
      return diff > 0 ? diff : 0;
    }
    return 0;
  };

  // Infer country from trip location or existing destinations
  const inferCountry = () => {
    if (!trip) return '';
    // Check if there are existing destinations with a country
    if (trip.destinations?.length > 0) {
      const destWithCountry = trip.destinations.find(d => d.country);
      if (destWithCountry) return destWithCountry.country;
    }
    // Try to extract country from trip location (e.g., "Tokyo, Japan" -> "Japan")
    if (trip.location) {
      const parts = trip.location.split(',').map(p => p.trim());
      if (parts.length > 1) {
        return parts[parts.length - 1]; // Last part is usually the country
      }
      return trip.location; // Single value, assume it's the country
    }
    return '';
  };

  // Populate form for edit mode
  useEffect(() => {
    if (destination) {
      setFormData({
        city_name: destination.city_name || '',
        country: destination.country || '',
        arrival_date: destination.arrival_date || '',
        departure_date: destination.departure_date || '',
        notes: destination.notes || '',
        latitude: destination.latitude || '',
        longitude: destination.longitude || '',
      });
    } else {
      setFormData({
        city_name: '',
        country: inferCountry(),
        arrival_date: '',
        departure_date: '',
        notes: '',
        latitude: '',
        longitude: '',
      });
    }
    setErrors({});
  }, [destination, isOpen, trip]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.city_name.trim()) {
      newErrors.city_name = 'City name is required';
    }

    if (!formData.arrival_date) {
      newErrors.arrival_date = 'Arrival date is required';
    }

    if (!formData.departure_date) {
      newErrors.departure_date = 'Departure date is required';
    }

    if (formData.arrival_date && formData.departure_date) {
      if (new Date(formData.departure_date) <= new Date(formData.arrival_date)) {
        newErrors.departure_date = 'Departure must be after arrival';
      }
    }

    // Validate dates are within trip date range
    if (trip && formData.arrival_date) {
      if (new Date(formData.arrival_date) < new Date(trip.start_date)) {
        newErrors.arrival_date = `Arrival must be on or after trip start (${trip.start_date})`;
      }
      if (new Date(formData.arrival_date) > new Date(trip.end_date)) {
        newErrors.arrival_date = `Arrival must be on or before trip end (${trip.end_date})`;
      }
    }

    if (trip && formData.departure_date) {
      if (new Date(formData.departure_date) > new Date(trip.end_date)) {
        newErrors.departure_date = `Departure must be on or before trip end (${trip.end_date})`;
      }
      if (new Date(formData.departure_date) < new Date(trip.start_date)) {
        newErrors.departure_date = `Departure must be on or after trip start (${trip.start_date})`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      const destinationData = {
        ...formData,
        trip_id: tripId,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
      };

      let result;
      if (isEditMode) {
        result = await updateDestination(destination.id, destinationData);
      } else {
        result = await createDestination(destinationData);
      }

      onSuccess?.(result);
      onClose();
    } catch (error) {
      setErrors({ submit: error.message });
    }
  };

  // Common countries (can be expanded)
  const countries = [
    'Japan', 'Norway', 'Sweden', 'Denmark', 'Finland', 'Iceland',
    'United States', 'Canada', 'United Kingdom', 'France', 'Germany',
    'Italy', 'Spain', 'Portugal', 'Netherlands', 'Belgium', 'Switzerland',
    'Australia', 'New Zealand', 'Thailand', 'Vietnam', 'South Korea',
  ].sort();

  if (!isOpen) return null;

  const nights = calculateNights();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto text-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <MapPin className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              {isEditMode ? 'Edit Destination' : 'Add Destination'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* City Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              City *
            </label>
            <input
              type="text"
              value={formData.city_name}
              onChange={(e) => setFormData({ ...formData, city_name: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 ${
                errors.city_name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="e.g., Tokyo, Oslo, Paris"
            />
            {errors.city_name && (
              <p className="text-red-500 text-xs mt-1">{errors.city_name}</p>
            )}
          </div>

          {/* Country */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Country
            </label>
            <input
              type="text"
              list="countries"
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900"
              placeholder="Select or type country (optional)"
            />
            <datalist id="countries">
              {countries.map((country) => (
                <option key={country} value={country} />
              ))}
            </datalist>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Arrival Date *
              </label>
              <input
                type="date"
                value={formData.arrival_date}
                onChange={(e) => setFormData({ ...formData, arrival_date: e.target.value })}
                min={trip?.start_date}
                max={trip?.end_date}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 ${
                  errors.arrival_date ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.arrival_date && (
                <p className="text-red-500 text-xs mt-1">{errors.arrival_date}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Departure Date *
              </label>
              <input
                type="date"
                value={formData.departure_date}
                onChange={(e) => setFormData({ ...formData, departure_date: e.target.value })}
                min={trip?.start_date}
                max={trip?.end_date}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 ${
                  errors.departure_date ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.departure_date && (
                <p className="text-red-500 text-xs mt-1">{errors.departure_date}</p>
              )}
            </div>
          </div>

          {/* Nights indicator */}
          {nights > 0 && (
            <div className="bg-indigo-50 text-indigo-700 px-3 py-2 rounded-lg text-sm flex items-center">
              <Calendar className="w-4 h-4 mr-2" />
              {nights} night{nights !== 1 ? 's' : ''}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900"
              rows={3}
              placeholder="Any notes about this destination..."
            />
          </div>

          {/* Error Message */}
          {errors.submit && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
              {errors.submit}
            </div>
          )}

          {/* Buttons */}
          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : isEditMode ? 'Save Changes' : 'Add Destination'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DestinationFormModal;
