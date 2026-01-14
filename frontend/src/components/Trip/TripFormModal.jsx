import React, { useState, useEffect } from 'react';
import { X, Plane } from 'lucide-react';
import useTripStore from '../../stores/useTripStore';

const TripFormModal = ({ isOpen, onClose, trip = null, onSuccess }) => {
  const { createTrip, updateTrip, isLoading } = useTripStore();
  const isEditMode = !!trip;

  const [formData, setFormData] = useState({
    name: '',
    location: '',
    description: '',
    start_date: '',
    end_date: '',
    total_budget: '',
    currency: 'USD',
    status: 'planning',
  });

  const [errors, setErrors] = useState({});

  // Populate form for edit mode
  useEffect(() => {
    if (trip) {
      setFormData({
        name: trip.name || '',
        location: trip.location || '',
        description: trip.description || '',
        start_date: trip.start_date || '',
        end_date: trip.end_date || '',
        total_budget: trip.total_budget || '',
        currency: trip.currency || 'USD',
        status: trip.status || 'planning',
      });
    } else {
      // Reset form for create mode
      setFormData({
        name: '',
        location: '',
        description: '',
        start_date: '',
        end_date: '',
        total_budget: '',
        currency: 'USD',
        status: 'planning',
      });
    }
  }, [trip, isOpen]);

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
      const tripData = {
        ...formData,
        total_budget: formData.total_budget ? Number(formData.total_budget) : null,
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
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <Plane className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              {isEditMode ? 'Edit Trip' : 'Create New Trip'}
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
          {/* Trip Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Trip Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white ${
                errors.name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="e.g., Japan Adventure 2026"
            />
            {errors.name && (
              <p className="text-red-500 text-xs mt-1">{errors.name}</p>
            )}
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Location
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white"
              placeholder="e.g., Japan, Tokyo"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
              rows={3}
              placeholder="Brief description of your trip..."
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date *
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white ${
                  errors.start_date ? 'border-red-500' : 'border-gray-300'
                }`}
                style={{ colorScheme: 'light' }}
              />
              {errors.start_date && (
                <p className="text-red-500 text-xs mt-1">{errors.start_date}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date *
              </label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white ${
                  errors.end_date ? 'border-red-500' : 'border-gray-300'
                }`}
                style={{ colorScheme: 'light' }}
              />
              {errors.end_date && (
                <p className="text-red-500 text-xs mt-1">{errors.end_date}</p>
              )}
            </div>
          </div>

          {/* Budget */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Budget
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.total_budget}
                onChange={(e) => setFormData({ ...formData, total_budget: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Currency
              </label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white"
              >
                {currencies.map((curr) => (
                  <option key={curr} value={curr} className="text-gray-900">{curr}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Status (edit mode only) */}
          {isEditMode && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white"
              >
                {statuses.map((status) => (
                  <option key={status.value} value={status.value} className="text-gray-900">
                    {status.label}
                  </option>
                ))}
              </select>
            </div>
          )}

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
              {isLoading ? 'Saving...' : isEditMode ? 'Save Changes' : 'Create Trip'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TripFormModal;
