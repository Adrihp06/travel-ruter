import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, MapPin, Building, Image as ImageIcon } from 'lucide-react';
import XIcon from '@/components/icons/x-icon';
import CopyIcon from '@/components/icons/copy-icon';
import FileDescriptionIcon from '@/components/icons/file-description-icon';
import DateRangePicker from '../common/DateRangePicker';

const TripDuplicateModal = ({ isOpen, onClose, trip, onDuplicate }) => {
  const { t } = useTranslation();
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
      newErrors.name = t('trips.tripNameRequired');
    }

    if (!formData.start_date) {
      newErrors.start_date = t('trips.startDateRequired');
    }

    if (!formData.end_date) {
      newErrors.end_date = t('trips.endDateRequired');
    }

    if (formData.start_date && formData.end_date) {
      const start = new Date(formData.start_date);
      const end = new Date(formData.end_date);
      if (end < start) {
        newErrors.end_date = t('trips.endAfterStart');
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
      setErrors({ submit: error.message || t('trips.failedDuplicate') });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 modal-backdrop bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="modal-content bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-200/50 dark:border-gray-700/50">
        {/* Header */}
        <div className="modal-header flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="modal-icon-container primary">
              <CopyIcon className="w-5 h-5 text-[#D97706] dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {t('trips.duplicateTrip')}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('trips.createCopyOf', { name: trip?.name || trip?.title })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="modal-close-btn p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
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
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className={`modal-input w-full px-4 py-2.5 rounded-xl dark:bg-gray-700 dark:text-white ${
                  errors.name ? 'border-red-500 focus:border-red-500' : ''
                }`}
                placeholder={t('trips.enterTripName')}
              />
              {errors.name && (
                <p className="mt-1.5 text-sm text-red-500 flex items-center gap-1">
                  <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                  {errors.name}
                </p>
              )}
            </div>

            {/* Date Range */}
            <div>
              <label className="modal-label">
                <Calendar className="w-4 h-4" />
                {t('trips.tripDates')} <span className="text-red-500">*</span>
              </label>
              <DateRangePicker
                startDate={formData.start_date}
                endDate={formData.end_date}
                onChange={handleDateRangeChange}
                error={errors.start_date || errors.end_date}
              />
              {(errors.start_date || errors.end_date) && (
                <p className="mt-1.5 text-sm text-red-500 flex items-center gap-1">
                  <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                  {errors.start_date || errors.end_date}
                </p>
              )}
            </div>

          {/* Duplication Options */}
          <div className="modal-section space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {t('trips.whatToInclude')}
            </h3>

            <div className="space-y-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 border border-gray-100 dark:border-gray-700/50">
              {/* Destinations */}
              <label className="flex items-start space-x-3 cursor-pointer group">
                <div className="flex items-center h-5">
                  <input
                    type="checkbox"
                    checked={formData.include_destinations}
                    onChange={() => handleCheckboxChange('include_destinations')}
                    className="w-4 h-4 text-[#D97706] border-gray-300 rounded focus:ring-[#D97706]/50 dark:border-gray-600 dark:bg-gray-700"
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4 text-[#D97706] dark:text-amber-400" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {t('trips.includeDestinations')}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {t('trips.includeDestinationsDesc')}
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
                    className="w-4 h-4 text-[#D97706] border-gray-300 rounded focus:ring-[#D97706]/50 dark:border-gray-600 dark:bg-gray-700 disabled:cursor-not-allowed"
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {t('trips.includePois')}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {t('trips.includePoisDesc')}
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
                    className="w-4 h-4 text-[#D97706] border-gray-300 rounded focus:ring-[#D97706]/50 dark:border-gray-600 dark:bg-gray-700 disabled:cursor-not-allowed"
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <Building className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {t('trips.includeAccommodations')}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {t('trips.includeAccommodationsDesc')}
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
                    className="w-4 h-4 text-[#D97706] border-gray-300 rounded focus:ring-[#D97706]/50 dark:border-gray-600 dark:bg-gray-700"
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <FileDescriptionIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {t('trips.includeDocuments')}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {t('trips.includeDocumentsDesc')}
                  </p>
                </div>
              </label>
            </div>

            <div className="text-xs text-gray-500 dark:text-gray-400 bg-gradient-to-br from-amber-50 to-orange-50/50 dark:from-amber-900/20 dark:to-orange-900/10 rounded-xl p-4 border border-amber-200/70 dark:border-amber-800/50">
              <p className="font-semibold text-amber-900 dark:text-amber-300 mb-2 flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                {t('trips.duplicateNote')}
              </p>
              <ul className="space-y-1.5 list-disc list-inside text-amber-800 dark:text-amber-300/80">
                <li>{t('trips.duplicateNoteStatus')}</li>
                <li>{t('trips.duplicateNoteDates')}</li>
                <li>{t('trips.duplicateNotePoi')}</li>
              </ul>
            </div>
          </div>

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

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
            <button
              type="button"
              onClick={onClose}
              className="modal-btn modal-btn-secondary"
              disabled={isSubmitting}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="modal-btn modal-btn-primary"
            >
              {isSubmitting ? (
                <>
                  <span className="modal-spinner" />
                  <span>{t('trips.duplicating')}</span>
                </>
              ) : (
                <>
                  <CopyIcon className="w-4 h-4" />
                  <span>{t('trips.duplicateTrip')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TripDuplicateModal;
