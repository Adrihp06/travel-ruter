import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import RightChevron from '@/components/icons/right-chevron';
import HomeIcon from '@/components/icons/home-icon';
import useBreadcrumbData from '../../hooks/useBreadcrumbData';

const LoadingSkeleton = () => (
  <span className="inline-block w-20 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
);

// Map of route segments to translation keys
const ROUTE_LABEL_KEYS = {
  trips: 'nav.trips',
  settings: 'nav.settings',
  'ai-settings': 'nav.aiSettings',
};

const Breadcrumbs = ({ className = "" }) => {
  const { t } = useTranslation();
  const { breadcrumbs, isLoading } = useBreadcrumbData();

  // Translate known route labels
  const getTranslatedLabel = (label) => {
    const key = ROUTE_LABEL_KEYS[label.toLowerCase()];
    return key ? t(key) : label;
  };

  return (
    <nav aria-label="Breadcrumb" className={`flex items-center space-x-1 sm:space-x-2 text-sm text-gray-500 dark:text-gray-400 overflow-hidden ${className || 'mb-4'}`}>
      <Link to="/" className="hover:text-gray-900 dark:hover:text-white flex items-center flex-shrink-0">
        <HomeIcon className="w-4 h-4" />
      </Link>
      {breadcrumbs.length > 0 && <RightChevron className="w-4 h-4 flex-shrink-0" />}
      {breadcrumbs.map(({ path, label, isLast, isClickable, onClick }, index) => {
        const isNumericId = /^\d+$/.test(label);
        const showSkeleton = isLoading && isNumericId;
        const displayLabel = getTranslatedLabel(label);

        return (
          <div key={path || `breadcrumb-${index}`} className="flex items-center min-w-0">
            {isLast || !isClickable ? (
              <span className={`truncate max-w-[120px] sm:max-w-[200px] md:max-w-none ${isLast ? "font-medium text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400"}`}>
                {showSkeleton ? <LoadingSkeleton /> : displayLabel}
              </span>
            ) : (
              <Link to={path} onClick={onClick} className="hover:text-gray-900 dark:hover:text-white truncate max-w-[120px] sm:max-w-[200px] md:max-w-none">
                {showSkeleton ? <LoadingSkeleton /> : displayLabel}
              </Link>
            )}
            {!isLast && <RightChevron className="w-4 h-4 ml-1 sm:ml-2 flex-shrink-0" />}
          </div>
        );
      })}
    </nav>
  );
};

export default Breadcrumbs;
