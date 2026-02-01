import React from 'react';
import { useLocation } from 'react-router-dom';

const PageTransition = ({ children }) => {
  const location = useLocation();

  return (
    <div
      className="w-full h-full page-transition-enter"
      key={location.pathname}
    >
      {children}
    </div>
  );
};

export default PageTransition;
