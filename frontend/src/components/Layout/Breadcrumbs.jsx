import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import useBreadcrumbData from '../../hooks/useBreadcrumbData';

const LoadingSkeleton = () => (
  <span className="inline-block w-20 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
);

const Breadcrumbs = ({ className = "" }) => {
  const { breadcrumbs, isLoading } = useBreadcrumbData();

  return (
    <nav aria-label="Breadcrumb" className={`flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400 ${className || 'mb-4'}`}>
      <Link to="/" className="hover:text-gray-900 dark:hover:text-white flex items-center">
        <Home className="w-4 h-4" />
      </Link>
      {breadcrumbs.length > 0 && <ChevronRight className="w-4 h-4" />}
      {breadcrumbs.map(({ path, label, isLast, isClickable, onClick }, index) => {
        const isNumericId = /^\d+$/.test(label);
        const showSkeleton = isLoading && isNumericId;

        return (
          <div key={path || `breadcrumb-${index}`} className="flex items-center">
            {isLast || !isClickable ? (
              <span className={isLast ? "font-medium text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400"}>
                {showSkeleton ? <LoadingSkeleton /> : label}
              </span>
            ) : (
              <Link to={path} onClick={onClick} className="hover:text-gray-900 dark:hover:text-white">
                {showSkeleton ? <LoadingSkeleton /> : label}
              </Link>
            )}
            {!isLast && <ChevronRight className="w-4 h-4 ml-2" />}
          </div>
        );
      })}
    </nav>
  );
};

export default Breadcrumbs;
