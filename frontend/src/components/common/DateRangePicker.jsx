import React, { forwardRef } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import { Calendar } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { es } from 'date-fns/locale/es';
import 'react-datepicker/dist/react-datepicker.css';

registerLocale('es', es);

// Custom input component for consistent styling
const CustomInput = forwardRef(({ value, onClick, placeholder, hasError, className }, ref) => (
  <div className="relative">
    <input
      type="text"
      ref={ref}
      value={value}
      onClick={onClick}
      readOnly
      placeholder={placeholder}
      className={`w-full px-3 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-[#D97706]/50 focus:border-[#D97706] text-gray-900 dark:text-white bg-white dark:bg-gray-700 cursor-pointer ${
        hasError ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
      } ${className || ''}`}
    />
    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
  </div>
));

CustomInput.displayName = 'CustomInput';

/**
 * DateRangePicker component for selecting start and end dates
 * End date picker opens to the start date month when available
 */
const DateRangePicker = ({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  startLabel,
  endLabel,
  startPlaceholder,
  endPlaceholder,
  minDate = null,
  maxDate = null,
  startError = null,
  endError = null,
  required = false,
  showDuration = true,
  className = '',
}) => {
  const { t, i18n } = useTranslation();

  const resolvedStartLabel = startLabel || t('trips.startDate');
  const resolvedEndLabel = endLabel || t('trips.endDate');
  const resolvedStartPlaceholder = startPlaceholder || t('dates.selectStartDate');
  const resolvedEndPlaceholder = endPlaceholder || t('dates.selectEndDate');
  const datepickerLocale = i18n.language?.startsWith('es') ? 'es' : undefined;

  // Parse date strings to Date objects
  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr + 'T00:00:00');
    return isNaN(date.getTime()) ? null : date;
  };

  // Format Date object to YYYY-MM-DD string
  const formatDate = (date) => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const startDateObj = parseDate(startDate);
  const endDateObj = parseDate(endDate);
  const minDateObj = parseDate(minDate);
  const maxDateObj = parseDate(maxDate);

  // Calculate duration between dates
  const calculateDuration = () => {
    if (startDateObj && endDateObj && endDateObj >= startDateObj) {
      const days = Math.ceil((endDateObj - startDateObj) / (1000 * 60 * 60 * 24)) + 1;
      const nights = days - 1;
      return { days, nights };
    }
    return null;
  };

  const duration = showDuration ? calculateDuration() : null;

  // Determine the date to open end picker to
  const getEndOpenToDate = () => {
    if (startDateObj) {
      return startDateObj;
    }
    return new Date();
  };

  return (
    <div className={className}>
      <div className="grid grid-cols-2 gap-4">
        {/* Start Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {resolvedStartLabel} {required && '*'}
          </label>
          <DatePicker
            selected={startDateObj}
            onChange={(date) => onStartChange(formatDate(date))}
            selectsStart
            startDate={startDateObj}
            endDate={endDateObj}
            minDate={minDateObj}
            maxDate={maxDateObj}
            dateFormat="yyyy-MM-dd"
            placeholderText={resolvedStartPlaceholder}
            customInput={<CustomInput hasError={!!startError} />}
            highlightDates={endDateObj ? [endDateObj] : []}
            showMonthDropdown
            showYearDropdown
            dropdownMode="select"
            popperPlacement="bottom-start"
            locale={datepickerLocale}
          />
          {startError && (
            <p className="text-red-500 dark:text-red-400 text-xs mt-1">{startError}</p>
          )}
        </div>

        {/* End Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {resolvedEndLabel} {required && '*'}
          </label>
          <DatePicker
            selected={endDateObj}
            onChange={(date) => onEndChange(formatDate(date))}
            selectsEnd
            startDate={startDateObj}
            endDate={endDateObj}
            minDate={startDateObj || minDateObj}
            maxDate={maxDateObj}
            openToDate={getEndOpenToDate()}
            dateFormat="yyyy-MM-dd"
            placeholderText={resolvedEndPlaceholder}
            customInput={<CustomInput hasError={!!endError} />}
            highlightDates={startDateObj ? [startDateObj] : []}
            showMonthDropdown
            showYearDropdown
            dropdownMode="select"
            popperPlacement="bottom-start"
            locale={datepickerLocale}
          />
          {endError && (
            <p className="text-red-500 dark:text-red-400 text-xs mt-1">{endError}</p>
          )}
        </div>
      </div>

      {/* Duration display */}
      {duration && (
        <div className="mt-3 flex items-center space-x-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
          <Calendar className="w-5 h-5 text-[#D97706] dark:text-amber-400" />
          <span className="text-sm text-[#D97706] dark:text-amber-300">
            <span className="font-medium">{t('common.dayCount', { count: duration.days })}</span>
            {duration.nights > 0 && (
              <span className="text-[#D97706] dark:text-amber-400">
                {' '}({t('common.nightCount', { count: duration.nights })})
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  );
};

export default DateRangePicker;
