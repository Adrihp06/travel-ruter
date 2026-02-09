import React, { useState } from 'react';
import { Download, Calendar as CalendarIcon } from 'lucide-react';
import CheckedIcon from '@/components/icons/checked-icon';
import { exportTripToICS } from '../../utils/icsExport';

const CalendarExport = ({ trip, destinations, pois, accommodations }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const handleExport = () => {
    try {
      exportTripToICS({ trip, destinations, pois, accommodations });

      // Show success feedback
      setExportSuccess(true);
      setTimeout(() => {
        setExportSuccess(false);
        setShowDropdown(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to export calendar:', error);
      alert('Failed to export calendar. Please try again.');
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium text-sm"
      >
        <Download className="w-4 h-4" />
        Export
      </button>

      {showDropdown && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowDropdown(false)}
          />

          {/* Dropdown Menu */}
          <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20 overflow-hidden">
            <div className="p-3 border-b border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Export Calendar
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Download your trip as a calendar file
              </p>
            </div>

            <div className="p-2">
              {exportSuccess ? (
                <div className="flex items-center justify-center gap-2 py-4 text-green-600 dark:text-green-400">
                  <CheckedIcon className="w-5 h-5" />
                  <span className="text-sm font-medium">Exported successfully!</span>
                </div>
              ) : (
                <button
                  onClick={handleExport}
                  className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                >
                  <CalendarIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      iCalendar (.ics)
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Compatible with Google Calendar, Apple Calendar, Outlook, and more
                    </div>
                  </div>
                </button>
              )}
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                The exported file includes all destinations, POIs, and accommodations from your trip.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CalendarExport;
