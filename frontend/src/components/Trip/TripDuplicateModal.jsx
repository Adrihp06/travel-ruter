import React, { useState, useEffect } from 'react';
import { X, Copy, Calendar, FileText, MapPin, Building, Image as ImageIcon } from 'lucide-react';
import DateRangePicker from '../common/DateRangePicker';

const TripDuplicateModal = ({ isOpen, onClose, trip, onDuplicate }) => {
  const [formData, setFormData] = useState({
    name: '',
    start_date: '',
    end_date: '',
    include_destinations: true,
    include_pois: false,
    include_accommodations: false,
    include_documents: false,
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form data when trip changes
  useEffect(() => {
    if (trip && isOpen) {
      const defaultName = `${trip.name || trip.title} (Copy)`;

      // Calculate new dates (default to 1 year from original start date)
      const originalStart = trip.start_date ? new Date(trip.start_date) : new Date();
      const originalEnd = trip.end_date ? new Date(trip.end_date) : new Date();

      const newStart = new Date(originalStart);
      newStart.setFullYear(newStart.getFullYear() + 1);

      const newEnd = new Date(originalEnd);
      newEnd.setFullYear(newEnd.getFullYear() + 1);

      setFormData({
        name: defaultName,
        start_date: newStart.toISOString().split('T')[0],
        end_date: newEnd.toISOString().split('T')[0],
        include_destinations: true,
        include_pois: false,
        include_accommodations: false,
        include_documents: false,
      });
      setErrors({});
    }
  }, [trip, isOpen]);

  const handleDateRangeChange = (startDate, endDate) => {
    setFormData(prev => ({
      ...prev,
      start_date: startDate,
      end_date: endDate,
    }));
    // Clear date-related errors
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.start_date;
      delete newErrors.end_date;
      return newErrors;
    });
  };

  const handleCheckboxChange = (field) => {
    setFormData(prev => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const validate = () => {
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
      const start = new Date(formData.start_date);
      const end = new Date(formData.end_date);
      if (end < start) {
        newErrors.end_date = 'End date must be on or after start date';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await onDuplicate(formData);
      onClose();
    } catch (error) {
      setErrors({ submit: error.message || 'Failed to duplicate trip' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Copy className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Duplicate Trip
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Create a copy of "{trip?.name || trip?.title}"
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Trip Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Trip Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:border-gray-600 ${
                errors.name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter trip name"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-500">{errors.name}</p>
            )}
          </div>

          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Trip Dates *
            </label>
            <DateRangePicker
              startDate={formData.start_date}
              endDate={formData.end_date}
              onChange={handleDateRangeChange}
              error={errors.start_date || errors.end_date}
            />
            {(errors.start_date || errors.end_date) && (
              <p className="mt-1 text-sm text-red-500">
                {errors.start_date || errors.end_date}
              </p>
            )}
          </div>

          {/* Duplication Options */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              What to Include
            </h3>

            <div className="space-y-3 bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
              {/* Destinations */}
              <label className="flex items-start space-x-3 cursor-pointer group">
                <div className="flex items-center h-5">
                  <input
                    type="checkbox"
                    checked={formData.include_destinations}
                    onChange={() => handleCheckboxChange('include_destinations')}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      Destinations
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Copy all destinations and their basic information
                  </p>
                </div>
              </label>

              {/* POIs */}
              <label className={`flex items-start space-x-3 cursor-pointer group ${
                !formData.include_destinations ? 'opacity-50 cursor-not-allowed' : ''
              }`}>
                <div className="flex items-center h-5">
                  <input
                    type="checkbox"
                    checked={formData.include_pois}
                    onChange={() => handleCheckboxChange('include_pois')}
                    disabled={!formData.include_destinations}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 disabled:cursor-not-allowed"
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      Points of Interest
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Copy all POIs with estimated costs (actual costs reset to zero)
                  </p>
                </div>
              </label>

              {/* Accommodations */}
              <label className={`flex items-start space-x-3 cursor-pointer group ${
                !formData.include_destinations ? 'opacity-50 cursor-not-allowed' : ''
              }`}>
                <div className="flex items-center h-5">
                  <input
                    type="checkbox"
                    checked={formData.include_accommodations}
                    onChange={() => handleCheckboxChange('include_accommodations')}
                    disabled={!formData.include_destinations}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 disabled:cursor-not-allowed"
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <Building className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      Accommodations
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Copy accommodation details (booking references and payment status will be reset)
                  </p>
                </div>
              </label>

              {/* Documents */}
              <label className="flex items-start space-x-3 cursor-pointer group">
                <div className="flex items-center h-5">
                  <input
                    type="checkbox"
                    checked={formData.include_documents}
                    onChange={() => handleCheckboxChange('include_documents')}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      Documents
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Copy document references (files will be shared between trips)
                  </p>
                </div>
              </label>
            </div>

            <div className="text-xs text-gray-500 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
              <p className="font-medium text-blue-900 dark:text-blue-300 mb-1">Note:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>The new trip will always have status set to "Planning"</li>
                <li>All dates will be automatically adjusted based on the new start date</li>
                <li>POI engagement metrics (likes/vetoes) will be reset</li>
              </ul>
            </div>
          </div>

          {/* Error Message */}
          {errors.submit && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-600 dark:text-red-400">{errors.submit}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              <Copy className="w-4 h-4" />
              <span>{isSubmitting ? 'Duplicating...' : 'Duplicate Trip'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TripDuplicateModal;
