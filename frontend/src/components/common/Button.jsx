import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Button Component
 *
 * Variants: primary, secondary, ghost, danger, success
 * Sizes: xs, sm, md, lg
 */
const Button = React.forwardRef(({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  leftIcon = null,
  rightIcon = null,
  fullWidth = false,
  type = 'button',
  className = '',
  ...props
}, ref) => {
  // Base styles
  const baseStyles = `
    inline-flex items-center justify-center font-medium rounded-lg
    transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed
  `;

  // Variant styles
  const variants = {
    primary: `
      bg-[#D97706] text-white
      hover:bg-[#B45309] active:bg-amber-800
      focus:ring-[#D97706]/50
      dark:bg-[#D97706] dark:hover:bg-[#D97706]
    `,
    secondary: `
      bg-white text-gray-700 border border-gray-300
      hover:bg-gray-50 active:bg-gray-100
      focus:ring-gray-500
      dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600
      dark:hover:bg-gray-700
    `,
    ghost: `
      bg-transparent text-gray-700
      hover:bg-gray-100 active:bg-gray-200
      focus:ring-gray-500
      dark:text-gray-300 dark:hover:bg-gray-800
    `,
    danger: `
      bg-red-600 text-white
      hover:bg-red-700 active:bg-red-800
      focus:ring-red-500
      dark:bg-red-500 dark:hover:bg-red-600
    `,
    success: `
      bg-green-600 text-white
      hover:bg-green-700 active:bg-green-800
      focus:ring-green-500
      dark:bg-green-500 dark:hover:bg-green-600
    `,
    outline: `
      bg-transparent text-[#D97706] border-2 border-[#D97706]
      hover:bg-amber-50 active:bg-amber-100
      focus:ring-[#D97706]/50
      dark:text-amber-400 dark:border-amber-400
      dark:hover:bg-amber-900/20
    `,
  };

  // Size styles
  const sizes = {
    xs: 'px-2.5 py-1 text-xs gap-1',
    sm: 'px-3 py-1.5 text-sm gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-5 py-2.5 text-base gap-2',
    xl: 'px-6 py-3 text-lg gap-2.5',
  };

  // Icon sizes
  const iconSizes = {
    xs: 'w-3 h-3',
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
    xl: 'w-5 h-5',
  };

  const isDisabled = disabled || isLoading;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      className={`
        ${baseStyles}
        ${variants[variant]}
        ${sizes[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      {...props}
    >
      {isLoading ? (
        <Loader2 className={`${iconSizes[size]} animate-spin`} />
      ) : leftIcon ? (
        <span className={iconSizes[size]}>{leftIcon}</span>
      ) : null}

      {children}

      {!isLoading && rightIcon && (
        <span className={iconSizes[size]}>{rightIcon}</span>
      )}
    </button>
  );
});

Button.displayName = 'Button';

// Button Group for grouped buttons
export const ButtonGroup = ({ children, className = '' }) => (
  <div className={`inline-flex rounded-lg overflow-hidden ${className}`}>
    {React.Children.map(children, (child, index) => {
      if (!React.isValidElement(child)) return child;
      return React.cloneElement(child, {
        className: `
          ${child.props.className || ''}
          rounded-none
          ${index === 0 ? 'rounded-l-lg' : ''}
          ${index === React.Children.count(children) - 1 ? 'rounded-r-lg' : ''}
          ${index > 0 ? '-ml-px' : ''}
        `,
      });
    })}
  </div>
);

export default Button;
