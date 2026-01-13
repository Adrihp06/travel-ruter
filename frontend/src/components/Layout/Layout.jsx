import React, { useState } from 'react';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import Breadcrumbs from './Breadcrumbs';

const Layout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const { id } = useParams();
  
  // Check if we are in a view that should be full-width (itinerary or home)
  const isFullWidthView = location.pathname === '/trips' || (location.pathname.startsWith('/trips/') && id);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar - Hide on Full Width Views to give more space */}
      {!isFullWidthView && (
        <Sidebar 
          isOpen={isSidebarOpen} 
          onClose={() => setIsSidebarOpen(false)} 
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center h-16 px-4 border-b border-gray-200 bg-white">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 -ml-2 rounded-md hover:bg-gray-100 focus:outline-none"
          >
            <Menu className="w-6 h-6 text-gray-600" />
          </button>
          <span className="ml-4 text-lg font-semibold text-gray-900">Travel Ruter</span>
        </header>

        {/* Main Content Area */}
        <main className={`flex-1 overflow-y-auto ${isFullWidthView ? 'p-0' : 'p-4 md:p-8'}`}>
          <div className={isFullWidthView ? 'h-full w-full' : 'max-w-7xl mx-auto'}>
            {!isFullWidthView && <Breadcrumbs />}
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
