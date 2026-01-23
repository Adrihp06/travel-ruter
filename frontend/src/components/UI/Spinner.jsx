import React from 'react';
import { Loader2 } from 'lucide-react';

const Spinner = ({ className = '', size = 'sm', color = 'current' }) => {
  const sizeClasses = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  };

  return (
    <Loader2 
      className={`animate-spin ${sizeClasses[size] || sizeClasses.sm} ${className}`} 
      color={color === 'current' ? undefined : color}
    />
  );
};

export default Spinner;
