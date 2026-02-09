import React, { useState, useRef, useEffect } from 'react';

/**
 * Tooltip Component
 *
 * Positions: top, bottom, left, right
 * Triggers: hover, click, focus
 */
const Tooltip = ({
  children,
  content,
  position = 'top',
  trigger = 'hover',
  delay = 200,
  className = '',
  contentClassName = '',
  arrow = true,
  disabled = false,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [actualPosition, setActualPosition] = useState(position);
  const timeoutRef = useRef(null);
  const containerRef = useRef(null);
  const tooltipRef = useRef(null);

  // Position styles
  const positions = {
    top: {
      tooltip: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
      arrow: 'top-full left-1/2 -translate-x-1/2 border-t-gray-900 dark:border-t-gray-700 border-l-transparent border-r-transparent border-b-transparent',
    },
    bottom: {
      tooltip: 'top-full left-1/2 -translate-x-1/2 mt-2',
      arrow: 'bottom-full left-1/2 -translate-x-1/2 border-b-gray-900 dark:border-b-gray-700 border-l-transparent border-r-transparent border-t-transparent',
    },
    left: {
      tooltip: 'right-full top-1/2 -translate-y-1/2 mr-2',
      arrow: 'left-full top-1/2 -translate-y-1/2 border-l-gray-900 dark:border-l-gray-700 border-t-transparent border-b-transparent border-r-transparent',
    },
    right: {
      tooltip: 'left-full top-1/2 -translate-y-1/2 ml-2',
      arrow: 'right-full top-1/2 -translate-y-1/2 border-r-gray-900 dark:border-r-gray-700 border-t-transparent border-b-transparent border-l-transparent',
    },
  };

  // Adjust position if tooltip would overflow viewport
  useEffect(() => {
    if (isVisible && tooltipRef.current && containerRef.current) {
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();
      const padding = 8;

      let newPosition = position;

      // Check horizontal overflow
      if (position === 'right' && tooltipRect.right > window.innerWidth - padding) {
        newPosition = 'left';
      } else if (position === 'left' && tooltipRect.left < padding) {
        newPosition = 'right';
      }

      // Check vertical overflow
      if (position === 'top' && tooltipRect.top < padding) {
        newPosition = 'bottom';
      } else if (position === 'bottom' && tooltipRect.bottom > window.innerHeight - padding) {
        newPosition = 'top';
      }

      if (newPosition !== actualPosition) {
        setActualPosition(newPosition);
      }
    }
  }, [isVisible, position, actualPosition]);

  // Show tooltip
  const show = () => {
    if (disabled || !content) return;
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  // Hide tooltip
  const hide = () => {
    clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  // Toggle for click trigger
  const toggle = () => {
    if (disabled || !content) return;
    setIsVisible(!isVisible);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => clearTimeout(timeoutRef.current);
  }, []);

  // Build event handlers based on trigger
  const getTriggerProps = () => {
    const props = {};

    if (trigger === 'hover' || trigger === 'both') {
      props.onMouseEnter = show;
      props.onMouseLeave = hide;
    }

    if (trigger === 'click' || trigger === 'both') {
      props.onClick = toggle;
    }

    if (trigger === 'focus' || trigger === 'both') {
      props.onFocus = show;
      props.onBlur = hide;
    }

    return props;
  };

  const positionStyles = positions[actualPosition];

  return (
    <div
      ref={containerRef}
      className={`relative inline-block ${className}`}
      {...getTriggerProps()}
    >
      {children}

      {/* Tooltip */}
      {isVisible && content && (
        <div
          ref={tooltipRef}
          role="tooltip"
          className={`
            absolute z-[100] px-2 py-1
            bg-gray-900 dark:bg-gray-700 text-white
            text-xs font-medium rounded-md shadow-lg
            whitespace-nowrap pointer-events-none
            animate-in fade-in duration-150
            ${positionStyles.tooltip}
            ${contentClassName}
          `}
        >
          {content}

          {/* Arrow */}
          {arrow && (
            <span
              className={`
                absolute w-0 h-0 border-4
                ${positionStyles.arrow}
              `}
            />
          )}
        </div>
      )}
    </div>
  );
};

// InfoTooltip - for information icons
export const InfoTooltip = ({ content, size = 'sm', ...props }) => {
  const sizes = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
  };

  return (
    <Tooltip content={content} {...props}>
      <button
        type="button"
        className={`${sizes[size]} rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center justify-center text-xs font-medium transition-colors`}
        aria-label="More information"
      >
        ?
      </button>
    </Tooltip>
  );
};

export default Tooltip;
