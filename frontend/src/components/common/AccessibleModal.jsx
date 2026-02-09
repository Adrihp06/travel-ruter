import React, { useEffect, useCallback, useId } from 'react';
import XIcon from '@/components/icons/x-icon';
import { useFocusTrap } from '../../hooks/useFocusTrap';

/**
 * Accessible Modal Component
 * Provides a fully accessible modal wrapper with:
 * - role="dialog" and aria-modal="true"
 * - aria-labelledby linked to title
 * - ESC key to close
 * - Click outside to close (optional)
 * - Focus trapping
 * - Return focus to trigger on close
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {function} props.onClose - Callback when modal should close
 * @param {string} props.title - Modal title (required for accessibility)
 * @param {React.ReactNode} props.children - Modal content
 * @param {boolean} props.closeOnOutsideClick - Close when clicking backdrop (default: true)
 * @param {boolean} props.closeOnEscape - Close when pressing ESC (default: true)
 * @param {boolean} props.showCloseButton - Show close button in header (default: true)
 * @param {string} props.size - Modal size: 'sm', 'md', 'lg', 'xl', 'full' (default: 'md')
 * @param {string} props.className - Additional CSS classes for modal content
 * @param {string} props.backdropClassName - Additional CSS classes for backdrop
 * @param {React.ReactNode} props.headerContent - Additional content for header
 * @param {React.ReactNode} props.footer - Footer content
 * @param {string} props.description - Optional description for aria-describedby
 */
const AccessibleModal = ({
  isOpen,
  onClose,
  title,
  children,
  closeOnOutsideClick = true,
  closeOnEscape = true,
  showCloseButton = true,
  size = 'md',
  className = '',
  backdropClassName = '',
  headerContent,
  footer,
  description,
}) => {
  const titleId = useId();
  const descriptionId = useId();
  const { containerRef } = useFocusTrap(isOpen);

  // Handle ESC key
  const handleKeyDown = useCallback((event) => {
    if (closeOnEscape && event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  }, [closeOnEscape, onClose]);

  // Handle backdrop click
  const handleBackdropClick = useCallback((event) => {
    if (closeOnOutsideClick && event.target === event.currentTarget) {
      onClose();
    }
  }, [closeOnOutsideClick, onClose]);

  // Add/remove event listeners
  useEffect(() => {
    if (!isOpen) return;

    document.addEventListener('keydown', handleKeyDown);

    // Prevent body scroll when modal is open
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  // Size classes mapping
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-6xl',
    full: 'max-w-[90vw]',
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 ${backdropClassName}`}
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={`
          bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full
          ${sizeClasses[size] || sizeClasses.md}
          max-h-[90vh] overflow-hidden flex flex-col
          border border-gray-200/50 dark:border-gray-700/50
          ${className}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex-1 min-w-0">
            <h2
              id={titleId}
              className="text-lg font-semibold text-gray-900 dark:text-white truncate"
            >
              {title}
            </h2>
            {description && (
              <p
                id={descriptionId}
                className="text-sm text-gray-500 dark:text-gray-400 mt-1"
              >
                {description}
              </p>
            )}
          </div>
          {headerContent}
          {showCloseButton && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ml-2"
              aria-label="Close modal"
            >
              <XIcon className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default AccessibleModal;
