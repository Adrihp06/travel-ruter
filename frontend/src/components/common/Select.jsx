import React, { useState, useRef, useEffect, useId } from 'react';
import DownChevron from '@/components/icons/down-chevron';
import CheckedIcon from '@/components/icons/checked-icon';
import MagnifierIcon from '@/components/icons/magnifier-icon';
import XIcon from '@/components/icons/x-icon';

/**
 * Select Component
 *
 * Features: searchable, multi-select, custom options
 */
const Select = React.forwardRef(({
  label,
  options = [],
  value,
  onChange,
  placeholder = 'Select...',
  searchable = false,
  searchPlaceholder = 'Search...',
  multiple = false,
  disabled = false,
  error,
  hint,
  clearable = false,
  size = 'md',
  className = '',
  renderOption,
  getOptionLabel = (opt) => opt.label || opt.name || opt,
  getOptionValue = (opt) => opt.value || opt.id || opt,
  ...props
}, ref) => {
  const generatedId = useId();
  const selectId = props.id || generatedId;
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Size styles
  const sizes = {
    sm: {
      trigger: 'px-3 py-1.5 text-sm',
      label: 'text-xs',
      option: 'px-3 py-1.5 text-sm',
    },
    md: {
      trigger: 'px-3 py-2 text-sm',
      label: 'text-sm',
      option: 'px-3 py-2 text-sm',
    },
    lg: {
      trigger: 'px-4 py-2.5 text-base',
      label: 'text-base',
      option: 'px-4 py-2.5 text-base',
    },
  };

  const sizeStyles = sizes[size];

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchTerm('');
    } else if (e.key === 'Enter' && !isOpen) {
      setIsOpen(true);
    }
  };

  // Filter options based on search
  const filteredOptions = searchable && searchTerm
    ? options.filter((opt) =>
        getOptionLabel(opt).toLowerCase().includes(searchTerm.toLowerCase())
      )
    : options;

  // Get selected options
  const getSelectedOptions = () => {
    if (!value) return [];
    if (multiple) {
      return options.filter((opt) =>
        (Array.isArray(value) ? value : [value]).includes(getOptionValue(opt))
      );
    }
    return options.filter((opt) => getOptionValue(opt) === value);
  };

  const selectedOptions = getSelectedOptions();

  // Handle option click
  const handleOptionClick = (option) => {
    const optionValue = getOptionValue(option);

    if (multiple) {
      const currentValues = Array.isArray(value) ? value : [];
      const newValues = currentValues.includes(optionValue)
        ? currentValues.filter((v) => v !== optionValue)
        : [...currentValues, optionValue];
      onChange?.(newValues);
    } else {
      onChange?.(optionValue);
      setIsOpen(false);
      setSearchTerm('');
    }
  };

  // Handle clear
  const handleClear = (e) => {
    e.stopPropagation();
    onChange?.(multiple ? [] : '');
  };

  // Check if option is selected
  const isOptionSelected = (option) => {
    const optionValue = getOptionValue(option);
    if (multiple) {
      return (Array.isArray(value) ? value : []).includes(optionValue);
    }
    return value === optionValue;
  };

  // Display value
  const displayValue = () => {
    if (selectedOptions.length === 0) return placeholder;
    if (multiple) {
      return selectedOptions.length === 1
        ? getOptionLabel(selectedOptions[0])
        : `${selectedOptions.length} selected`;
    }
    return getOptionLabel(selectedOptions[0]);
  };

  const hasValue = multiple ? selectedOptions.length > 0 : !!value;

  return (
    <div className={`flex flex-col gap-1.5 w-full ${className}`} ref={containerRef}>
      {label && (
        <label
          htmlFor={selectId}
          className={`font-medium text-gray-700 dark:text-gray-300 ${sizeStyles.label}`}
        >
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        {/* Trigger Button */}
        <button
          ref={ref}
          id={selectId}
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          onKeyDown={handleKeyDown}
          className={`
            w-full flex items-center justify-between rounded-lg border bg-white dark:bg-gray-800
            text-left text-gray-900 dark:text-white
            focus:outline-none focus:ring-4 focus:ring-[#D97706]/50/20 focus:border-[#D97706]
            transition-colors duration-200
            disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50 dark:disabled:bg-gray-900
            ${sizeStyles.trigger}
            ${error
              ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
              : 'border-gray-300 dark:border-gray-600'
            }
          `}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span className={`truncate ${!hasValue ? 'text-gray-400 dark:text-gray-500' : ''}`}>
            {displayValue()}
          </span>

          <div className="flex items-center gap-1 ml-2 flex-shrink-0">
            {clearable && hasValue && (
              <button
                type="button"
                onClick={handleClear}
                className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                aria-label="Clear selection"
              >
                <XIcon className="w-4 h-4 text-gray-400" />
              </button>
            )}
            <DownChevron
              className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            />
          </div>
        </button>

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-hidden">
            {/* Search Input */}
            {searchable && (
              <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                <div className="relative">
                  <MagnifierIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="w-full pl-9 pr-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-[#D97706]/50/20 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            )}

            {/* Options */}
            <div className="overflow-y-auto max-h-48" role="listbox">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                  No options found
                </div>
              ) : (
                filteredOptions.map((option, index) => {
                  const isSelected = isOptionSelected(option);
                  const optionValue = getOptionValue(option);

                  return (
                    <button
                      key={optionValue || index}
                      type="button"
                      onClick={() => handleOptionClick(option)}
                      className={`
                        w-full flex items-center justify-between text-left
                        hover:bg-gray-100 dark:hover:bg-gray-700
                        transition-colors duration-150
                        ${sizeStyles.option}
                        ${isSelected
                          ? 'bg-amber-50 dark:bg-amber-900/20 text-[#D97706] dark:text-amber-400'
                          : 'text-gray-900 dark:text-white'
                        }
                      `}
                      role="option"
                      aria-selected={isSelected}
                    >
                      {renderOption ? (
                        renderOption(option, isSelected)
                      ) : (
                        <>
                          <span className="truncate">{getOptionLabel(option)}</span>
                          {isSelected && <CheckedIcon className="w-4 h-4 flex-shrink-0 ml-2" />}
                        </>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <p className="text-red-500 dark:text-red-400 text-xs" role="alert">
          {error}
        </p>
      )}

      {/* Hint Text */}
      {hint && !error && (
        <p className="text-gray-500 dark:text-gray-400 text-xs">
          {hint}
        </p>
      )}
    </div>
  );
});

Select.displayName = 'Select';

export default Select;
