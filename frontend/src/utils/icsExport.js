/**
 * Utility functions for generating .ics (iCalendar) files
 * Compatible with Google Calendar, Apple Calendar, and other calendar applications
 */

// Format date to iCalendar format (YYYYMMDD or YYYYMMDDTHHmmssZ)
const formatICSDate = (dateStr, includeTime = false) => {
  const date = new Date(dateStr + 'T00:00:00');

  if (includeTime) {
    // Format with time in UTC
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  } else {
    // Format as date only (all-day event)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }
};

// Get current timestamp in iCalendar format
const getICSTimestamp = () => {
  return new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
};

// Escape special characters in iCalendar text fields
const escapeICSText = (text) => {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
};

// Generate a unique event UID
const generateUID = (id, type) => {
  return `${type}-${id}@travel-ruter.app`;
};

// Create an iCalendar event
const createICSEvent = ({
  uid,
  summary,
  description,
  location,
  startDate,
  endDate,
  allDay = true,
  categories = [],
  url,
}) => {
  const timestamp = getICSTimestamp();

  let event = 'BEGIN:VEVENT\r\n';
  event += `UID:${uid}\r\n`;
  event += `DTSTAMP:${timestamp}\r\n`;

  if (allDay) {
    event += `DTSTART;VALUE=DATE:${formatICSDate(startDate)}\r\n`;
    if (endDate) {
      // For all-day events, end date is exclusive (next day)
      const nextDay = new Date(endDate + 'T00:00:00');
      nextDay.setDate(nextDay.getDate() + 1);
      const endDateStr = nextDay.toISOString().split('T')[0];
      event += `DTEND;VALUE=DATE:${formatICSDate(endDateStr)}\r\n`;
    }
  } else {
    event += `DTSTART:${formatICSDate(startDate, true)}\r\n`;
    if (endDate) {
      event += `DTEND:${formatICSDate(endDate, true)}\r\n`;
    }
  }

  event += `SUMMARY:${escapeICSText(summary)}\r\n`;

  if (description) {
    event += `DESCRIPTION:${escapeICSText(description)}\r\n`;
  }

  if (location) {
    event += `LOCATION:${escapeICSText(location)}\r\n`;
  }

  if (categories && categories.length > 0) {
    event += `CATEGORIES:${categories.map(escapeICSText).join(',')}\r\n`;
  }

  if (url) {
    event += `URL:${url}\r\n`;
  }

  event += 'END:VEVENT\r\n';

  return event;
};

/**
 * Generate .ics file content for a trip
 * @param {Object} trip - Trip object
 * @param {Array} destinations - Array of destination objects
 * @param {Array} pois - Array of POI objects
 * @param {Array} accommodations - Array of accommodation objects
 * @returns {string} iCalendar format string
 */
export const generateICSContent = ({ trip, destinations = [], pois = [], accommodations = [] }) => {
  let icsContent = 'BEGIN:VCALENDAR\r\n';
  icsContent += 'VERSION:2.0\r\n';
  icsContent += 'PRODID:-//Travel Ruter//Calendar Export//EN\r\n';
  icsContent += 'CALSCALE:GREGORIAN\r\n';
  icsContent += 'METHOD:PUBLISH\r\n';
  icsContent += `X-WR-CALNAME:${escapeICSText(trip.name || 'Trip')}\r\n`;
  icsContent += `X-WR-CALDESC:${escapeICSText(trip.location || 'Travel itinerary')}\r\n`;
  icsContent += 'X-WR-TIMEZONE:UTC\r\n';

  // Add trip as an event
  if (trip.start_date && trip.end_date) {
    icsContent += createICSEvent({
      uid: generateUID(trip.id, 'trip'),
      summary: `🌍 ${trip.name}`,
      description: `Trip to ${trip.location || 'multiple destinations'}`,
      location: trip.location,
      startDate: trip.start_date,
      endDate: trip.end_date,
      allDay: true,
      categories: ['Travel', 'Trip'],
    });
  }

  // Add destinations
  destinations.forEach(destination => {
    if (!destination.arrival_date) return;

    // Arrival event
    icsContent += createICSEvent({
      uid: generateUID(`${destination.id}-arrival`, 'destination'),
      summary: `✈️ Arrive in ${destination.city_name}`,
      description: `Arrival in ${destination.city_name}${destination.country ? ', ' + destination.country : ''}`,
      location: `${destination.city_name}${destination.country ? ', ' + destination.country : ''}`,
      startDate: destination.arrival_date,
      allDay: true,
      categories: ['Travel', 'Arrival'],
    });

    // Departure event (if available)
    if (destination.departure_date) {
      icsContent += createICSEvent({
        uid: generateUID(`${destination.id}-departure`, 'destination'),
        summary: `🛫 Depart from ${destination.city_name}`,
        description: `Departure from ${destination.city_name}${destination.country ? ', ' + destination.country : ''}`,
        location: `${destination.city_name}${destination.country ? ', ' + destination.country : ''}`,
        startDate: destination.departure_date,
        allDay: true,
        categories: ['Travel', 'Departure'],
      });
    }
  });

  // Add POIs
  pois.forEach(poi => {
    if (!poi.scheduled_date) return;

    const destinationName = destinations.find(d => d.id === poi.destination_id)?.city_name || '';

    let description = '';
    if (poi.description) {
      description += poi.description;
    }
    if (poi.dwell_time) {
      const hours = Math.floor(poi.dwell_time / 60);
      const mins = poi.dwell_time % 60;
      const dwellTimeStr = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
      description += (description ? '\\n\\n' : '') + `Duration: ${dwellTimeStr}`;
    }
    if (poi.estimated_cost) {
      description += (description ? '\\n' : '') + `Cost: $${poi.estimated_cost}`;
    }

    icsContent += createICSEvent({
      uid: generateUID(poi.id, 'poi'),
      summary: `📍 ${poi.name}`,
      description,
      location: destinationName,
      startDate: poi.scheduled_date,
      allDay: true,
      categories: ['Travel', 'POI', poi.category].filter(Boolean),
    });
  });

  // Add accommodations
  accommodations.forEach(accommodation => {
    if (!accommodation.check_in_date || !accommodation.check_out_date) return;

    const destinationName = destinations.find(d => d.id === accommodation.destination_id)?.city_name || '';

    let description = `${accommodation.type || 'Accommodation'}`;
    if (accommodation.booking_reference) {
      description += `\\nBooking Reference: ${accommodation.booking_reference}`;
    }
    if (accommodation.total_cost) {
      description += `\\nCost: ${accommodation.currency || '$'}${accommodation.total_cost}`;
    }
    if (accommodation.amenities && Object.keys(accommodation.amenities).length > 0) {
      description += `\\nAmenities: ${Object.keys(accommodation.amenities).join(', ')}`;
    }

    icsContent += createICSEvent({
      uid: generateUID(accommodation.id, 'accommodation'),
      summary: `🏨 ${accommodation.name}`,
      description,
      location: destinationName,
      startDate: accommodation.check_in_date,
      endDate: accommodation.check_out_date,
      allDay: true,
      categories: ['Travel', 'Accommodation'],
    });
  });

  icsContent += 'END:VCALENDAR\r\n';

  return icsContent;
};

/**
 * Download .ics file
 * @param {string} content - iCalendar content
 * @param {string} filename - Filename for the download
 */
export const downloadICSFile = (content, filename = 'trip.ics') => {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up the URL object
  setTimeout(() => URL.revokeObjectURL(url), 100);
};

/**
 * Generate and download .ics file for a trip
 * @param {Object} options - Trip data
 */
export const exportTripToICS = ({ trip, destinations, pois, accommodations }) => {
  const content = generateICSContent({ trip, destinations, pois, accommodations });
  const filename = `${trip.name?.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'trip'}.ics`;
  downloadICSFile(content, filename);
};
