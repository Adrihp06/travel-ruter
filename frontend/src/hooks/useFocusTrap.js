import { useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for trapping focus within a container (e.g., modals, dialogs)
 * @param {boolean} isActive - Whether the focus trap should be active
 * @param {Object} options - Configuration options
 * @param {boolean} options.returnFocus - Whether to return focus to trigger element on close (default: true)
 * @param {boolean} options.autoFocus - Whether to auto-focus the first focusable element (default: true)
 * @param {string} options.initialFocusSelector - CSS selector for initial focus element (optional)
 * @returns {Object} - { containerRef } to attach to the container element
 */
export const useFocusTrap = (isActive, options = {}) => {
  const {
    returnFocus = true,
    autoFocus = true,
    initialFocusSelector = null,
  } = options;

  const containerRef = useRef(null);
  const previousActiveElementRef = useRef(null);

  // Focusable elements selector
  const FOCUSABLE_SELECTOR = [
    'a[href]',
    'area[href]',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'button:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable]',
    'audio[controls]',
    'video[controls]',
    'details > summary:first-of-type',
  ].join(',');

  // Get all focusable elements within container
  const getFocusableElements = useCallback(() => {
    if (!containerRef.current) return [];
    const elements = containerRef.current.querySelectorAll(FOCUSABLE_SELECTOR);
    return Array.from(elements).filter(el => {
      // Filter out invisible elements
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
    });
  }, [FOCUSABLE_SELECTOR]);

  // Handle Tab key navigation
  const handleKeyDown = useCallback((event) => {
    if (!isActive || event.key !== 'Tab') return;

    const focusableElements = getFocusableElements();
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Shift+Tab on first element -> go to last
    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    }
    // Tab on last element -> go to first
    else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }, [isActive, getFocusableElements]);

  // Set up focus trap when activated
  useEffect(() => {
    if (!isActive) return;

    // Store the previously focused element
    if (returnFocus) {
      previousActiveElementRef.current = document.activeElement;
    }

    // Auto-focus first focusable element or specified element
    if (autoFocus && containerRef.current) {
      // Small delay to ensure container is rendered
      const timeoutId = setTimeout(() => {
        let elementToFocus = null;

        if (initialFocusSelector) {
          elementToFocus = containerRef.current?.querySelector(initialFocusSelector);
        }

        if (!elementToFocus) {
          const focusableElements = getFocusableElements();
          elementToFocus = focusableElements[0];
        }

        if (elementToFocus) {
          elementToFocus.focus();
        }
      }, 10);

      return () => clearTimeout(timeoutId);
    }
  }, [isActive, autoFocus, initialFocusSelector, getFocusableElements, returnFocus]);

  // Handle keydown events
  useEffect(() => {
    if (!isActive) return;

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isActive, handleKeyDown]);

  // Return focus on deactivation
  useEffect(() => {
    return () => {
      if (returnFocus && previousActiveElementRef.current && previousActiveElementRef.current.focus) {
        previousActiveElementRef.current.focus();
      }
    };
  }, [returnFocus]);

  return { containerRef };
};

export default useFocusTrap;
