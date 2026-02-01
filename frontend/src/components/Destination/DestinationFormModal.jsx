import React, { useState, useEffect, useMemo } from 'react';
import { X, MapPin, AlertTriangle } from 'lucide-react';
import useDestinationStore from '../../stores/useDestinationStore';
import LocationAutocomplete from '../Location/LocationAutocomplete';
import DateRangePicker from '../common/DateRangePicker';
import Spinner from '../UI/Spinner';
import { findDateCollisions, formatDateShort } from '../../utils/dateFormat';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const DestinationFormModal = ({
  isOpen,
  onClose,
  tripId,
  destination = null,
  onSuccess,
  trip = null,
  preFilledLocation = null, // { latitude, longitude } - for map click pre-fill
}) => {
  const { createDestination, updateDestination, isLoading } = useDestinationStore();
  const isEditMode = !!destination;

  // Use destinations from the trip prop (from useTripStore) for collision detection
  // This ensures we're checking against the same data that's displayed in the Timeline
  const existingDestinations = trip?.destinations || [];

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
  const [collisionWarningAcknowledged, setCollisionWarningAcknowledged] = useState(false);
  // Track dates to reset acknowledgment when they change
  const [acknowledgedForDates, setAcknowledgedForDates] = useState({ arrival: '', departure: '' });

  // Check for date collisions with existing destinations
  const dateCollisions = useMemo(() => {
    if (!formData.arrival_date || !formData.departure_date) return [];
    return findDateCollisions(
      formData.arrival_date,
      formData.departure_date,
      existingDestinations,
      isEditMode ? destination?.id : null
    );
  }, [formData.arrival_date, formData.departure_date, existingDestinations, isEditMode, destination?.id]);

  // Check if acknowledgment is valid for current dates
  const isAcknowledgmentValid = collisionWarningAcknowledged &&
    acknowledgedForDates.arrival === formData.arrival_date &&
    acknowledgedForDates.departure === formData.departure_date;

  // Handler to acknowledge warning for current dates
  const handleAcknowledgeWarning = () => {
    setCollisionWarningAcknowledged(true);
    setAcknowledgedForDates({
      arrival: formData.arrival_date,
      departure: formData.departure_date
    });
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

  // Parse city and country from geo API display_name (e.g., "Tokyo, Japan" or "Paris, Île-de-France, France")
  const parseCityAndCountry = (displayName) => {
    if (!displayName) return { city: '', country: '' };
    const parts = displayName.split(',').map(p => p.trim());
    if (parts.length === 0) return { city: '', country: '' };
    // First part is typically the city/location name
    const city = parts[0];
    // Last part is typically the country
    const country = parts.length > 1 ? parts[parts.length - 1] : '';
    return { city, country };
  };

  // Handle location selection from autocomplete
  const handleLocationSelect = (location) => {
    if (!location) return;
    const { city, country } = parseCityAndCountry(location.display_name);
    setFormData(prev => ({
      ...prev,
      city_name: city,
      country: country || prev.country, // Keep existing country if not found
      latitude: location.latitude,
      longitude: location.longitude,
    }));
  };

  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);

  // Reverse geocode coordinates to get city/country
  const reverseGeocode = async (latitude, longitude) => {
    setIsReverseGeocoding(true);
    try {
      const res = await fetch(`${API_BASE_URL}/geocoding/reverse?lat=${latitude}&lon=${longitude}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.display_name) {
          const { city, country } = parseCityAndCountry(data.display_name);
          setFormData(prev => ({
            ...prev,
            city_name: city || prev.city_name,
            country: country || prev.country,
            latitude,
            longitude,
          }));
        }
      }
    } catch (error) {
      console.error('Reverse geocoding failed:', error);
    } finally {
      setIsReverseGeocoding(false);
    }
  };

  // Populate form for edit mode or pre-filled location
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
    } else if (preFilledLocation?.latitude && preFilledLocation?.longitude) {
      // Pre-fill with coordinates from map click and reverse geocode
      setFormData({
        city_name: '',
        country: inferCountry(),
        arrival_date: '',
        departure_date: '',
        notes: '',
        latitude: preFilledLocation.latitude,
        longitude: preFilledLocation.longitude,
      });
      // Trigger reverse geocoding to fill city/country
      reverseGeocode(preFilledLocation.latitude, preFilledLocation.longitude);
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
    setCollisionWarningAcknowledged(false);
    setAcknowledgedForDates({ arrival: '', departure: '' });
  }, [destination, isOpen, trip, preFilledLocation]);

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

    // If there are validation errors, fail
    if (Object.keys(newErrors).length > 0) return false;

    // If there are date collisions and user hasn't acknowledged, require acknowledgment
    if (dateCollisions.length > 0 && !isAcknowledgmentValid) {
      return false;
    }

    return true;
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
          {/* Reverse geocoding indicator */}
          {isReverseGeocoding && (
            <div className="bg-indigo-50 text-indigo-700 p-3 rounded-lg text-sm flex items-center space-x-2">
              <Spinner className="w-4 h-4" />
              <span>Looking up location...</span>
            </div>
          )}

          {/* Pre-filled coordinates indicator */}
          {preFilledLocation && formData.latitude && formData.longitude && !isReverseGeocoding && (
            <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm">
              <p className="font-medium">Location selected from map</p>
              <p className="text-xs text-green-600 mt-1">
                {Number(formData.latitude).toFixed(6)}, {Number(formData.longitude).toFixed(6)}
              </p>
            </div>
          )}

          {/* City Name with Location Autocomplete */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              City *
            </label>
            <LocationAutocomplete
              value={formData.city_name}
              latitude={formData.latitude}
              longitude={formData.longitude}
              onChange={(value) => {
                // Only update city_name when user types (not from selection)
                setFormData(prev => ({ ...prev, city_name: value }));
              }}
              onSelect={handleLocationSelect}
              placeholder={isReverseGeocoding ? "Loading..." : "Search for a city..."}
              error={errors.city_name}
              disabled={isReverseGeocoding}
            />
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
          <DateRangePicker
            startDate={formData.arrival_date}
            endDate={formData.departure_date}
            onStartChange={(date) => setFormData({ ...formData, arrival_date: date })}
            onEndChange={(date) => setFormData({ ...formData, departure_date: date })}
            startLabel="Arrival Date"
            endLabel="Departure Date"
            minDate={trip?.start_date}
            maxDate={trip?.end_date}
            startError={errors.arrival_date}
            endError={errors.departure_date}
            required
            showDuration
          />

          {/* Date Collision Warning */}
          {dateCollisions.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-800">
                    Date overlap detected
                  </p>
                  <p className="text-sm text-amber-700 mt-1">
                    These dates overlap with{' '}
                    {dateCollisions.length === 1 ? (
                      <>
                        <strong>{dateCollisions[0]?.city_name || 'another destination'}</strong>{' '}
                        ({formatDateShort(dateCollisions[0]?.arrival_date)} - {formatDateShort(dateCollisions[0]?.departure_date)})
                      </>
                    ) : (
                      <>
                        {dateCollisions.length} other destinations:{' '}
                        {dateCollisions.map((d, i) => (
                          <span key={d?.id || i}>
                            {i > 0 && ', '}
                            <strong>{d?.city_name || 'Unknown'}</strong>
                          </span>
                        ))}
                      </>
                    )}
                  </p>
                  {!isAcknowledgmentValid && (
                    <button
                      type="button"
                      onClick={handleAcknowledgeWarning}
                      className="mt-2 text-sm font-medium text-amber-800 hover:text-amber-900 underline"
                    >
                      I understand, proceed anyway
                    </button>
                  )}
                  {isAcknowledgmentValid && (
                    <p className="mt-2 text-xs text-amber-600 italic">
                      ✓ Warning acknowledged
                    </p>
                  )}
                </div>
              </div>
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
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {isLoading && <Spinner className="text-white" />}
              <span>{isLoading ? 'Saving...' : isEditMode ? 'Save Changes' : 'Add Destination'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DestinationFormModal;
