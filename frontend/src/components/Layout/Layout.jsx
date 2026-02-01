import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import PageTransition from '../UI/PageTransition';

const Layout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  // Detect itinerary view: /trips/:id (where :id is a number or UUID)
  const isItineraryView = /^\/trips\/[a-zA-Z0-9-]+$/.test(location.pathname);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Sidebar - hidden in itinerary view (handled by DetailView) */}
      {!isItineraryView && (
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header - only in non-itinerary views */}
        {!isItineraryView && (
          <header className="md:hidden h-16 flex items-center justify-between px-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 transition-colors">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label="Open menu"
            >
              <Menu className="w-6 h-6 text-gray-600 dark:text-gray-300" />
            </button>
            <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">Travel Ruter</span>
            <div className="w-10" />
          </header>
        )}

        {/* Page Content */}
        <main className={`flex-1 ${isItineraryView ? 'h-screen' : 'overflow-auto'}`}>
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>
      </div>
    </div>
  );
};

export default Layout;
