import React, { useState, useId } from 'react';
import EyeIcon from '@/components/icons/eye-icon';
import EyeOffIcon from '@/components/icons/eye-off-icon';
import InfoCircleIcon from '@/components/icons/info-circle-icon';
import CheckedIcon from '@/components/icons/checked-icon';
import XIcon from '@/components/icons/x-icon';

/**
 * Input Component
 *
 * Types: text, email, password, number, date, search, tel, url
 * States: default, error, success, disabled
 */
const Input = React.forwardRef(({
  label,
  type = 'text',
  error,
  success,
  hint,
  leftIcon,
  rightIcon,
  size = 'md',
  fullWidth = true,
  showPasswordToggle = true,
  clearable = false,
  onClear,
  className = '',
  inputClassName = '',
  ...props
}, ref) => {
  const generatedId = useId();
  const inputId = props.id || generatedId;
  const [showPassword, setShowPassword] = useState(false);

  // Size styles
  const sizes = {
    sm: {
      input: 'px-3 py-1.5 text-sm',
      label: 'text-xs',
      icon: 'w-4 h-4',
      wrapper: 'gap-1',
    },
    md: {
      input: 'px-3 py-2 text-sm',
      label: 'text-sm',
      icon: 'w-4 h-4',
      wrapper: 'gap-1.5',
    },
    lg: {
      input: 'px-4 py-2.5 text-base',
      label: 'text-base',
      icon: 'w-5 h-5',
      wrapper: 'gap-2',
    },
  };

  const sizeStyles = sizes[size];

  // State styles
  const getStateStyles = () => {
    if (error) {
      return 'border-red-500 focus:border-red-500 focus:ring-red-500/20';
    }
    if (success) {
      return 'border-green-500 focus:border-green-500 focus:ring-green-500/20';
    }
    return 'border-gray-300 dark:border-gray-600 focus:border-[#D97706] focus:ring-[#D97706]/50/20';
  };

  // Determine actual input type
  const actualType = type === 'password' && showPassword ? 'text' : type;

  // Check if we need right padding for icons
  const hasRightContent = (type === 'password' && showPasswordToggle) ||
    rightIcon ||
    (clearable && props.value) ||
    error ||
    success;

  return (
    <div className={`flex flex-col ${sizeStyles.wrapper} ${fullWidth ? 'w-full' : ''} ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className={`font-medium text-gray-700 dark:text-gray-300 ${sizeStyles.label}`}
        >
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        {/* Left Icon */}
        {leftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none">
            <span className={sizeStyles.icon}>{leftIcon}</span>
          </div>
        )}

        {/* Input */}
        <input
          ref={ref}
          id={inputId}
          type={actualType}
          className={`
            w-full rounded-lg border bg-white dark:bg-gray-800
            text-gray-900 dark:text-white
            placeholder:text-gray-400 dark:placeholder:text-gray-500
            focus:outline-none focus:ring-4
            transition-colors duration-200
            disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50 dark:disabled:bg-gray-900
            ${sizeStyles.input}
            ${getStateStyles()}
            ${leftIcon ? 'pl-10' : ''}
            ${hasRightContent ? 'pr-10' : ''}
            ${inputClassName}
          `}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          {...props}
        />

        {/* Right Icon / Actions */}
        {hasRightContent && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {/* Password Toggle */}
            {type === 'password' && showPasswordToggle && (
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOffIcon className={sizeStyles.icon} />
                ) : (
                  <EyeIcon className={sizeStyles.icon} />
                )}
              </button>
            )}

            {/* Clear Button */}
            {clearable && props.value && !error && !success && type !== 'password' && (
              <button
                type="button"
                onClick={onClear}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1"
                tabIndex={-1}
                aria-label="Clear input"
              >
                <XIcon className={sizeStyles.icon} />
              </button>
            )}

            {/* State Icons */}
            {error && !clearable && <InfoCircleIcon className={`${sizeStyles.icon} text-red-500`} />}
            {success && !clearable && <CheckedIcon className={`${sizeStyles.icon} text-green-500`} />}

            {/* Custom Right Icon */}
            {rightIcon && !error && !success && type !== 'password' && (
              <span className={`${sizeStyles.icon} text-gray-400 dark:text-gray-500`}>
                {rightIcon}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <p
          id={`${inputId}-error`}
          className="text-red-500 dark:text-red-400 text-xs mt-1"
          role="alert"
        >
          {error}
        </p>
      )}

      {/* Hint Text */}
      {hint && !error && (
        <p
          id={`${inputId}-hint`}
          className="text-gray-500 dark:text-gray-400 text-xs mt-1"
        >
          {hint}
        </p>
      )}

      {/* Success Message */}
      {success && typeof success === 'string' && (
        <p className="text-green-500 dark:text-green-400 text-xs mt-1">
          {success}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

// Textarea variant
export const Textarea = React.forwardRef(({
  label,
  error,
  success,
  hint,
  rows = 4,
  resize = 'vertical',
  className = '',
  ...props
}, ref) => {
  const generatedId = useId();
  const inputId = props.id || generatedId;

  const resizeClasses = {
    none: 'resize-none',
    vertical: 'resize-y',
    horizontal: 'resize-x',
    both: 'resize',
  };

  const getStateStyles = () => {
    if (error) return 'border-red-500 focus:border-red-500 focus:ring-red-500/20';
    if (success) return 'border-green-500 focus:border-green-500 focus:ring-green-500/20';
    return 'border-gray-300 dark:border-gray-600 focus:border-[#D97706] focus:ring-[#D97706]/50/20';
  };

  return (
    <div className={`flex flex-col gap-1.5 w-full ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="font-medium text-sm text-gray-700 dark:text-gray-300"
        >
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        className={`
          w-full px-3 py-2 rounded-lg border bg-white dark:bg-gray-800
          text-gray-900 dark:text-white text-sm
          placeholder:text-gray-400 dark:placeholder:text-gray-500
          focus:outline-none focus:ring-4
          transition-colors duration-200
          disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50 dark:disabled:bg-gray-900
          ${getStateStyles()}
          ${resizeClasses[resize]}
        `}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        {...props}
      />

      {error && (
        <p id={`${inputId}-error`} className="text-red-500 dark:text-red-400 text-xs" role="alert">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={`${inputId}-hint`} className="text-gray-500 dark:text-gray-400 text-xs">
          {hint}
        </p>
      )}
    </div>
  );
});

Textarea.displayName = 'Textarea';

export default Input;
