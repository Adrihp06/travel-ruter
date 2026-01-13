import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

const Breadcrumbs = () => {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  return (
    <nav aria-label="Breadcrumb" className="flex items-center space-x-2 text-sm text-gray-500 mb-4">
      <Link to="/" className="hover:text-gray-900 flex items-center">
        <Home className="w-4 h-4" />
      </Link>
      {pathnames.length > 0 && <ChevronRight className="w-4 h-4" />}
      {pathnames.map((value, index) => {
        const to = `/${pathnames.slice(0, index + 1).join('/')}`;
        const isLast = index === pathnames.length - 1;

        return (
          <div key={to} className="flex items-center">
            {isLast ? (
              <span className="font-medium text-gray-900 capitalize">{value}</span>
            ) : (
              <Link to={to} className="hover:text-gray-900 capitalize">
                {value}
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
