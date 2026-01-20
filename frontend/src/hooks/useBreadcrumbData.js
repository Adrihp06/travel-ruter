import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import useTripStore from '../stores/useTripStore';
import useDestinationStore from '../stores/useDestinationStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

/**
 * Custom hook to fetch and provide breadcrumb data with trip and destination names
 * Parses the current URL and reads selected destination from store
 *
 * @returns {object} - { breadcrumbs, isLoading }
 *   breadcrumbs: Array of { path, label, isLast, isClickable, onClick }
 *   isLoading: boolean indicating if data is being fetched
 */
const useBreadcrumbData = () => {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  // Local state for fetched trip name
  const [tripName, setTripName] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Get existing store data
  const { selectedTrip, trips } = useTripStore();
  const { selectedDestination, resetSelectedDestination } = useDestinationStore();

  // Handler to go back to trip level (clear destination selection)
  const handleBackToTrip = useCallback(() => {
    resetSelectedDestination();
  }, [resetSelectedDestination]);

  // Parse URL to extract tripId
  const tripId = useMemo(() => {
    const tripsIndex = pathnames.indexOf('trips');
    if (tripsIndex !== -1 && pathnames[tripsIndex + 1]) {
      const id = parseInt(pathnames[tripsIndex + 1], 10);
      if (!isNaN(id)) {
        return id;
      }
    }
    return null;
  }, [pathnames]);

  // Fetch trip name when tripId changes
  useEffect(() => {
    if (!tripId) {
      setTripName(null);
      return;
    }

    // Check if we already have the trip in store
    const existingTrip = selectedTrip?.id === tripId
      ? selectedTrip
      : trips.find(t => t.id === tripId);

    if (existingTrip) {
      setTripName(existingTrip.name || existingTrip.title);
      return;
    }

    // Fetch trip if not in store
    const fetchTrip = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/trips/${tripId}`);
        if (response.ok) {
          const trip = await response.json();
          setTripName(trip.name || trip.title);
        }
      } catch {
        // Keep loading as false, will show ID as fallback
      } finally {
        setIsLoading(false);
      }
    };

    fetchTrip();
  }, [tripId, selectedTrip, trips]);

  // Build breadcrumb items with proper labels
  const breadcrumbs = useMemo(() => {
    const items = [];

    // Build breadcrumbs from URL path
    pathnames.forEach((value, index) => {
      const path = `/${pathnames.slice(0, index + 1).join('/')}`;
      let label = value;
      let onClick = null;

      // Check if this is a tripId segment (number after 'trips')
      const isTripSegment = tripId && index > 0 && pathnames[index - 1] === 'trips' && value === String(tripId);
      if (isTripSegment) {
        label = tripName || value;
        // When destination is selected, clicking trip should go back to trip level
        if (selectedDestination) {
          onClick = handleBackToTrip;
        }
      }
      // Capitalize known route names
      else if (['trips', 'destinations', 'accommodations', 'activities', 'documents', 'budget', 'itinerary', 'map', 'settings'].includes(value.toLowerCase())) {
        label = value.charAt(0).toUpperCase() + value.slice(1);
      }

      items.push({
        path,
        label,
        isLast: false,
        isClickable: true,
        onClick,
      });
    });

    // Add selected destination if present (from store, not URL)
    if (selectedDestination && tripId) {
      const destName = selectedDestination.city_name || selectedDestination.name;
      items.push({
        path: null, // No URL path since destination selection is state-based
        label: destName,
        isLast: true,
        isClickable: false,
        onClick: null,
      });
    }

    // Mark the last item
    if (items.length > 0 && !selectedDestination) {
      items[items.length - 1].isLast = true;
    }

    return items;
  }, [pathnames, tripId, tripName, selectedDestination, handleBackToTrip]);

  return {
    breadcrumbs,
    isLoading,
    tripId,
    tripName,
    selectedDestination,
  };
};

export default useBreadcrumbData;
