import React, { useId } from 'react';

/**
 * Accessible Form Field Component
 * Provides proper ARIA attributes for form fields:
 * - aria-describedby for error messages
 * - aria-invalid for error states
 * - aria-required for required fields
 * - Properly linked labels
 *
 * @param {Object} props
 * @param {string} props.label - Field label text
 * @param {string} props.error - Error message (if any)
 * @param {boolean} props.required - Whether field is required
 * @param {string} props.hint - Optional hint text
 * @param {React.ReactNode} props.children - Form input element(s)
 * @param {string} props.className - Additional CSS classes for container
 * @param {string} props.labelClassName - Additional CSS classes for label
 */
const FormField = ({
  label,
  error,
  required = false,
  hint,
  children,
  className = '',
  labelClassName = '',
}) => {
  const fieldId = useId();
  const errorId = useId();
  const hintId = useId();

  // Build aria-describedby value
  const describedBy = [
    error ? errorId : null,
    hint ? hintId : null,
  ].filter(Boolean).join(' ') || undefined;

  // Clone children to add accessibility props
  const enhancedChildren = React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return child;

    // Only enhance form elements
    const isFormElement = ['input', 'select', 'textarea'].includes(child.type) ||
      child.type?.displayName?.toLowerCase().includes('input') ||
      child.props?.type !== undefined;

    if (!isFormElement) return child;

    return React.cloneElement(child, {
      id: child.props.id || fieldId,
      'aria-describedby': describedBy,
      'aria-invalid': error ? 'true' : undefined,
      'aria-required': required ? 'true' : undefined,
      ...child.props,
    });
  });

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={fieldId}
          className={`block text-sm font-medium text-gray-700 dark:text-gray-300 ${labelClassName}`}
        >
          {label}
          {required && (
            <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>
          )}
        </label>
      )}

      {enhancedChildren}

      {hint && !error && (
        <p
          id={hintId}
          className="text-xs text-gray-500 dark:text-gray-400"
        >
          {hint}
        </p>
      )}

      {error && (
        <p
          id={errorId}
          role="alert"
          className="text-xs text-red-600 dark:text-red-400"
        >
          {error}
        </p>
      )}
    </div>
  );
};

/**
 * Higher-order component to wrap any input with FormField
 * @param {React.ComponentType} InputComponent - The input component to wrap
 * @returns {React.ComponentType} - Wrapped component with FormField
 */
export const withFormField = (InputComponent) => {
  return function FormFieldWrapper({ label, error, required, hint, fieldClassName, ...inputProps }) {
    return (
      <FormField
        label={label}
        error={error}
        required={required}
        hint={hint}
        className={fieldClassName}
      >
        <InputComponent {...inputProps} />
      </FormField>
    );
  };
};

export default FormField;
