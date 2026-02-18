import React, { useState, useEffect, useMemo, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Bed, Calendar, Building2 } from 'lucide-react';
import XIcon from '@/components/icons/x-icon';
import MagnifierIcon from '@/components/icons/magnifier-icon';
import useAccommodationStore from '../../stores/useAccommodationStore';
import LocationAutocomplete from '../Location/LocationAutocomplete';
import DateRangePicker from '../common/DateRangePicker';
import HotelSearchModal from '../Hotels/HotelSearchModal';

const AccommodationFormModal = ({
  isOpen,
  onClose,
  destinationId,
  destination = null,
  accommodation = null,
  preFillDates = null,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const { createAccommodation, updateAccommodation, isLoading } = useAccommodationStore();
  const isEditMode = !!accommodation;
  const titleId = useId();

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
    // Extended fields for booking integration
    external_id: null,
    provider: 'manual',
    room_type: '',
    cancellation_policy: '',
    photos: [],
    review_score: null,
    review_count: null,
  });

  const [errors, setErrors] = useState({});
  const [showHotelSearch, setShowHotelSearch] = useState(false);

  const accommodationTypes = [
    { value: 'hotel', label: t('accommodation.types.hotel') },
    { value: 'hostel', label: t('accommodation.types.hostel') },
    { value: 'airbnb', label: t('accommodation.types.airbnb') },
    { value: 'apartment', label: t('accommodation.types.apartment') },
    { value: 'resort', label: t('accommodation.types.resort') },
    { value: 'camping', label: t('accommodation.types.camping') },
    { value: 'guesthouse', label: t('accommodation.types.guesthouse') },
    { value: 'ryokan', label: t('accommodation.types.ryokan') },
    { value: 'other', label: t('accommodation.types.other') },
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
      display = t('accommodation.coversNight', { night: nights[0] });
    } else if (nights[nights.length - 1] - nights[0] + 1 === nights.length) {
      display = t('accommodation.coversNights', { start: nights[0], end: nights[nights.length - 1] });
    } else {
      display = t('accommodation.coversNights', { start: nights[0], end: nights[nights.length - 1] });
    }

    return { nights, display };
  }, [formData.check_in_date, formData.check_out_date, destination, t]);

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
      newErrors.name = t('accommodation.nameRequired');
    }

    if (!formData.check_in_date) {
      newErrors.check_in_date = t('accommodation.checkInRequired');
    }

    if (!formData.check_out_date) {
      newErrors.check_out_date = t('accommodation.checkOutRequired');
    }

    if (formData.check_in_date && formData.check_out_date) {
      if (new Date(formData.check_out_date) <= new Date(formData.check_in_date)) {
        newErrors.check_out_date = t('accommodation.checkOutAfterCheckIn');
      }
    }

    // Validate dates are within destination range
    if (destination && formData.check_in_date && formData.check_out_date) {
      const checkIn = new Date(formData.check_in_date);
      const checkOut = new Date(formData.check_out_date);
      const destArrival = new Date(destination.arrival_date);
      const destDeparture = new Date(destination.departure_date);

      if (checkIn < destArrival) {
        newErrors.check_in_date = t('accommodation.checkInBeforeArrival');
      }
      if (checkOut > destDeparture) {
        newErrors.check_out_date = t('accommodation.checkOutAfterDeparture');
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

  // Handle hotel selection from Amadeus search
  const handleHotelSelect = (data) => {
    const { accommodationData } = data;
    setFormData((prev) => ({
      ...prev,
      name: accommodationData.name || prev.name,
      type: accommodationData.type || prev.type,
      address: accommodationData.address || prev.address,
      latitude: accommodationData.latitude || prev.latitude,
      longitude: accommodationData.longitude || prev.longitude,
      total_cost: accommodationData.total_cost || prev.total_cost,
      currency: accommodationData.currency || prev.currency,
      booking_reference: accommodationData.booking_reference || prev.booking_reference,
      description: accommodationData.description || prev.description,
      external_id: accommodationData.external_id || null,
      provider: accommodationData.provider || 'google_places',
      room_type: accommodationData.room_type || '',
      cancellation_policy: accommodationData.cancellation_policy || '',
      photos: accommodationData.photos || [],
      review_score: accommodationData.review_score || null,
      review_count: accommodationData.review_count || null,
    }));
    setShowHotelSearch(false);
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
    <>
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      role="presentation"
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <Bed className="w-5 h-5 text-[#D97706] dark:text-amber-400" />
            <h3 id={titleId} className="text-lg font-semibold text-gray-900 dark:text-white">
              {isEditMode ? t('accommodation.edit') : t('accommodation.add')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            aria-label={t('common.close')}
          >
            <XIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Hotel Search Button */}
          {!isEditMode && (
            <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-[#D97706] dark:text-amber-400" />
                  <span className="text-sm text-[#D97706] dark:text-amber-300">
                    {t('accommodation.searchNearby')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHotelSearch(true)}
                  className="px-3 py-1.5 bg-[#D97706] text-white rounded-lg hover:bg-[#B45309] transition-colors text-sm flex items-center gap-1"
                >
                  <MagnifierIcon className="w-4 h-4" />
                  {t('accommodation.searchHotels')}
                </button>
              </div>
              {formData.provider === 'google_places' && (
                <p className="mt-2 text-xs text-[#D97706] dark:text-amber-400">
                  {t('accommodation.hotelSelected')}
                </p>
              )}
            </div>
          )}

          {/* Name & Type */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.name')} *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#D97706]/50 bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${errors.name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
                placeholder="e.g., Hotel Nyhavn"
              />
              {errors.name && <p className="text-red-500 dark:text-red-400 text-xs mt-1">{errors.name}</p>}
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.type')} *</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#D97706]/50 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {accommodationTypes.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Address with Geocoding */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('accommodation.addressLocation')}</label>
            <LocationAutocomplete
              value={formData.address}
              latitude={formData.latitude}
              longitude={formData.longitude}
              onChange={handleLocationChange}
              placeholder={t('accommodation.searchAddress')}
              className="[&_input]:dark:bg-gray-700 [&_input]:dark:text-white [&_input]:dark:border-gray-600"
            />
          </div>

          {/* Dates - Using DateRangePicker with min/max constraints */}
          <DateRangePicker
            startDate={formData.check_in_date}
            endDate={formData.check_out_date}
            onStartChange={(date) => setFormData({ ...formData, check_in_date: date })}
            onEndChange={(date) => setFormData({ ...formData, check_out_date: date })}
            startLabel={t('accommodation.checkIn')}
            endLabel={t('accommodation.checkOut')}
            startError={errors.check_in_date}
            endError={errors.check_out_date}
            minDate={destination?.arrival_date}
            maxDate={destination?.departure_date}
            required
            showDuration
          />

          {/* Night coverage indicator */}
          {nightCoverage.display && (
            <div className="bg-amber-50 dark:bg-amber-900/20 text-[#D97706] dark:text-amber-300 px-3 py-2 rounded-lg text-sm flex items-center">
              <Calendar className="w-4 h-4 mr-2" />
              <span>{nightCoverage.display}</span>
            </div>
          )}

          {/* Booking Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('accommodation.bookingRef')}</label>
              <input
                type="text"
                value={formData.booking_reference}
                onChange={(e) => setFormData({ ...formData, booking_reference: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#D97706]/50 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="ABC123"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('accommodation.bookingUrl')}</label>
              <input
                type="url"
                value={formData.booking_url}
                onChange={(e) => setFormData({ ...formData, booking_url: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#D97706]/50 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="https://..."
              />
            </div>
          </div>

          {/* Cost & Payment */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('accommodation.totalCost')}</label>
              <div className="flex h-[38px]">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.total_cost}
                  onChange={(e) => setFormData({ ...formData, total_cost: e.target.value })}
                  className="flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-l-lg focus:ring-2 focus:ring-[#D97706]/50 focus:z-10 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="px-2 py-2 border border-l-0 border-gray-300 dark:border-gray-600 rounded-r-lg focus:ring-2 focus:ring-[#D97706]/50 focus:z-10 bg-gray-50 dark:bg-gray-600 text-gray-900 dark:text-white"
                >
                  {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('accommodation.paymentStatus')}</label>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, is_paid: !formData.is_paid })}
                className={`w-full h-[38px] px-3 rounded-lg border transition-colors flex items-center justify-center space-x-2 ${
                  formData.is_paid
                    ? 'bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300'
                    : 'bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300'
                }`}
              >
                <span className={`w-3 h-3 rounded-full ${formData.is_paid ? 'bg-green-500' : 'bg-amber-500'}`} />
                <span>{formData.is_paid ? t('common.paid') : t('common.notPaid')}</span>
              </button>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.notes')}</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#D97706]/50 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              rows={3}
              placeholder={t('accommodation.additionalNotes')}
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
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-[#D97706] text-white rounded-lg hover:bg-[#B45309] disabled:opacity-50 transition-colors"
            >
              {isLoading ? t('common.saving') : isEditMode ? t('accommodation.saveChanges') : t('accommodation.add')}
            </button>
          </div>
        </form>
      </div>

    </div>

    {/* Hotel Search Modal - rendered outside backdrop to avoid event interception */}
    <HotelSearchModal
      isOpen={showHotelSearch}
      onClose={() => setShowHotelSearch(false)}
      destination={destination}
      onSelectHotel={handleHotelSelect}
    />
    </>
  );
};

export { HotelSearchModal };
export default AccommodationFormModal;
