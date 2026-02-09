import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import PageTransition from '../UI/PageTransition';
import { AIChat } from '../AI';
import useTripStore from '../../stores/useTripStore';

// Skip to main content link for keyboard navigation accessibility
const SkipToMain = () => (
  <a
    href="#main-content"
    className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[200] focus:px-4 focus:py-2 focus:bg-[#D97706] focus:text-white focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#D97706]/50"
  >
    Skip to main content
  </a>
);

const Layout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const location = useLocation();
  const { tripsWithDestinations } = useTripStore();

  // Detect itinerary view: /trips/:id (where :id is a number or UUID)
  const isItineraryView = /^\/trips\/[a-zA-Z0-9-]+$/.test(location.pathname);

  // Extract trip ID from pathname (useParams may have string; store uses numbers)
  const tripId = isItineraryView ? location.pathname.match(/\/trips\/([a-zA-Z0-9-]+)/)?.[1] : null;
  const tripIdNum = tripId ? Number(tripId) : null;
  const trip = tripIdNum ? tripsWithDestinations.find(t => t.id === tripIdNum || t.id === tripId) : null;

  const tripContext = isItineraryView && tripId ? {
    id: tripIdNum || tripId,
    name: trip?.title || trip?.name,
    startDate: trip?.start_date,
    endDate: trip?.end_date,
    budget: trip?.total_budget,
    currency: trip?.currency,
    destinations: trip?.destinations?.map(d => ({
      id: d.id,
      name: d.city_name || d.name,
      country: d.country,
      arrivalDate: d.arrival_date,
      departureDate: d.departure_date,
      lat: d.latitude,
      lng: d.longitude,
    })),
  } : undefined;

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Skip to main content link for accessibility */}
      <SkipToMain />
      {/* Sidebar - hidden in itinerary view (handled by DetailView) */}
      {!isItineraryView && (
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content Area - shrinks when chat is open */}
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
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
            <span className="text-xl font-bold text-[#D97706] dark:text-amber-400">Travel Ruter</span>
            <div className="w-10" />
          </header>
        )}

        {/* Page Content */}
        <main
          id="main-content"
          className={`flex-1 ${isItineraryView ? 'h-screen' : 'overflow-auto'}`}
          tabIndex={-1}
        >
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>
      </div>

      {/* AI Chat - slides in from the right as a side panel */}
      <AIChat
        tripContext={tripContext}
        isOpen={isChatOpen}
        onToggle={() => setIsChatOpen(prev => !prev)}
        onClose={() => setIsChatOpen(false)}
      />
    </div>
  );
};

export default Layout;
