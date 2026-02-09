import React, { forwardRef } from 'react';
import DatePicker from 'react-datepicker';
import { Calendar } from 'lucide-react';
import 'react-datepicker/dist/react-datepicker.css';

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
  startLabel = 'Start Date',
  endLabel = 'End Date',
  startPlaceholder = 'Select start date',
  endPlaceholder = 'Select end date',
  minDate = null,
  maxDate = null,
  startError = null,
  endError = null,
  required = false,
  showDuration = true,
  className = '',
}) => {
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
            {startLabel} {required && '*'}
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
            placeholderText={startPlaceholder}
            customInput={<CustomInput hasError={!!startError} />}
            highlightDates={endDateObj ? [endDateObj] : []}
            showMonthDropdown
            showYearDropdown
            dropdownMode="select"
            popperPlacement="bottom-start"
          />
          {startError && (
            <p className="text-red-500 dark:text-red-400 text-xs mt-1">{startError}</p>
          )}
        </div>

        {/* End Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {endLabel} {required && '*'}
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
            placeholderText={endPlaceholder}
            customInput={<CustomInput hasError={!!endError} />}
            highlightDates={startDateObj ? [startDateObj] : []}
            showMonthDropdown
            showYearDropdown
            dropdownMode="select"
            popperPlacement="bottom-start"
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
            <span className="font-medium">{duration.days} day{duration.days !== 1 ? 's' : ''}</span>
            {duration.nights > 0 && (
              <span className="text-[#D97706] dark:text-amber-400">
                {' '}({duration.nights} night{duration.nights !== 1 ? 's' : ''})
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  );
};

export default DateRangePicker;
