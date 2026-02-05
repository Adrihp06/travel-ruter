import { doDateRangesOverlap } from './dateFormat';

/**
 * Find all pairs of destinations with overlapping dates (conflicts)
 * @param {Array} destinations - Array of destination objects with arrival_date and departure_date
 * @returns {Array} Array of conflict objects { dest1, dest2 }
 */
export const findDestinationConflicts = (destinations) => {
  if (!destinations || destinations.length < 2) return [];

  const conflicts = [];
  const sorted = [...destinations].sort(
    (a, b) => new Date(a.arrival_date) - new Date(b.arrival_date)
  );

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const dest1 = sorted[i];
      const dest2 = sorted[j];

      if (doDateRangesOverlap(
        dest1.arrival_date,
        dest1.departure_date,
        dest2.arrival_date,
        dest2.departure_date
      )) {
        conflicts.push({ dest1, dest2 });
      }
    }
  }

  return conflicts;
};

/**
 * Generate all nights in a date range
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Array} Array of date strings (YYYY-MM-DD)
 */
export const generateNightDates = (startDate, endDate) => {
  const nights = [];
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current < end) {
    nights.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }

  return nights;
};

/**
 * Find nights that are not covered by any destination
 * @param {Object} trip - Trip object with start_date and end_date
 * @param {Array} destinations - Array of destinations with arrival_date and departure_date
 * @returns {Array} Array of uncovered night dates
 */
export const findUncoveredNights = (trip, destinations) => {
  if (!trip?.start_date || !trip?.end_date) return [];
  if (!destinations || destinations.length === 0) {
    // All nights are uncovered if no destinations
    return generateNightDates(trip.start_date, trip.end_date);
  }

  // Generate all nights in the trip
  const allNights = new Set(generateNightDates(trip.start_date, trip.end_date));

  // Remove nights covered by destinations
  destinations.forEach(dest => {
    if (dest.arrival_date && dest.departure_date) {
      const destNights = generateNightDates(dest.arrival_date, dest.departure_date);
      destNights.forEach(night => allNights.delete(night));
    }
  });

  return Array.from(allNights).sort();
};

/**
 * Find accommodation gaps within a destination
 * @param {Object} destination - Destination with arrival_date and departure_date
 * @param {Array} accommodations - Array of accommodations with check_in_date and check_out_date
 * @returns {Array} Array of uncovered night dates
 */
export const findAccommodationGaps = (destination, accommodations) => {
  if (!destination?.arrival_date || !destination?.departure_date) return [];

  // Generate all nights in the destination stay
  const allNights = new Set(generateNightDates(destination.arrival_date, destination.departure_date));

  // Remove nights covered by accommodations
  (accommodations || []).forEach(acc => {
    if (acc.check_in_date && acc.check_out_date) {
      const accNights = generateNightDates(acc.check_in_date, acc.check_out_date);
      accNights.forEach(night => allNights.delete(night));
    }
  });

  return Array.from(allNights).sort();
};

/**
 * Get a summary of all trip validation issues
 * @param {Object} trip - Trip object
 * @param {Array} destinations - Array of destinations
 * @param {Object} accommodationsByDestination - Map of destination_id -> accommodations[]
 * @returns {Object} { conflicts, uncoveredNights, accommodationGaps }
 */
export const getTripValidationSummary = (trip, destinations, accommodationsByDestination = {}) => {
  const conflicts = findDestinationConflicts(destinations);
  const uncoveredNights = findUncoveredNights(trip, destinations);

  // Calculate total accommodation gaps across all destinations
  let totalAccommodationGaps = [];
  (destinations || []).forEach(dest => {
    const accs = accommodationsByDestination[dest.id] || [];
    const gaps = findAccommodationGaps(dest, accs);
    if (gaps.length > 0) {
      totalAccommodationGaps.push({
        destination: dest,
        gaps,
      });
    }
  });

  return {
    conflicts,
    uncoveredNights,
    accommodationGaps: totalAccommodationGaps,
    hasIssues: conflicts.length > 0 || uncoveredNights.length > 0 || totalAccommodationGaps.length > 0,
  };
};
