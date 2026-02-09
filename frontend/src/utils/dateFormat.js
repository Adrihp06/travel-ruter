/**
 * Centralized date formatting utility
 * Provides consistent date formatting across the application with locale support
 */

const SETTINGS_KEY = 'travel-ruter-settings';

// Supported date locales
export const dateLocales = [
  { code: 'en-US', name: 'English (US)', example: 'Mar 10, 2026' },
  { code: 'en-GB', name: 'English (UK)', example: '10 Mar 2026' },
  { code: 'de-DE', name: 'German', example: '10. März 2026' },
  { code: 'fr-FR', name: 'French', example: '10 mars 2026' },
  { code: 'es-ES', name: 'Spanish', example: '10 mar 2026' },
  { code: 'it-IT', name: 'Italian', example: '10 mar 2026' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)', example: '10 de mar. de 2026' },
  { code: 'ja-JP', name: 'Japanese', example: '2026年3月10日' },
  { code: 'zh-CN', name: 'Chinese (Simplified)', example: '2026年3月10日' },
  { code: 'ko-KR', name: 'Korean', example: '2026. 3. 10.' },
  { code: 'nb-NO', name: 'Norwegian', example: '10. mars 2026' },
  { code: 'sv-SE', name: 'Swedish', example: '10 mars 2026' },
  { code: 'nl-NL', name: 'Dutch', example: '10 mrt 2026' },
];

// Cached locale to avoid repeated localStorage reads
let cachedLocale = null;

/**
 * Get the user's preferred date locale from settings
 * Falls back to browser locale if not set.
 * Caches the result to avoid repeated localStorage reads during renders.
 */
export const getDateLocale = () => {
  if (cachedLocale) return cachedLocale;
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const settings = JSON.parse(stored);
      if (settings.dateFormat?.locale) {
        cachedLocale = settings.dateFormat.locale;
        return cachedLocale;
      }
    }
  } catch {
    // Ignore errors
  }
  // Fall back to browser locale or 'en-US'
  cachedLocale = navigator.language || 'en-US';
  return cachedLocale;
};

/**
 * Invalidate the cached locale (call when user changes locale in settings)
 */
export const invalidateLocaleCache = () => {
  cachedLocale = null;
};

/**
 * Format a date with full format (month, day, year)
 * Example: "Mar 10, 2026" (en-US) or "10 Mar 2026" (en-GB)
 */
export const formatDateFull = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';

  const locale = getDateLocale();
  return date.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

/**
 * Format a date with short format (month and day only)
 * Example: "Mar 10" (en-US) or "10 Mar" (en-GB)
 */
export const formatDateShort = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';

  const locale = getDateLocale();
  return date.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Format a date with weekday (weekday, month, day)
 * Example: "Mon, Mar 10" (en-US) or "Mon, 10 Mar" (en-GB)
 */
export const formatDateWithWeekday = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';

  const locale = getDateLocale();
  return date.toLocaleDateString(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Format a date with long weekday (full weekday name, month, day)
 * Example: "Monday, Mar 10" (en-US)
 */
export const formatDateWithLongWeekday = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';

  const locale = getDateLocale();
  return date.toLocaleDateString(locale, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Format a date range
 * Example: "Mar 10, 2026 - Mar 15, 2026" or "Mar 10 - 15, 2026" if same month/year
 */
export const formatDateRange = (startDateStr, endDateStr) => {
  if (!startDateStr) return '';

  const startDate = new Date(startDateStr);
  if (isNaN(startDate.getTime())) return '';

  if (!endDateStr) {
    return formatDateFull(startDateStr);
  }

  const endDate = new Date(endDateStr);
  if (isNaN(endDate.getTime())) {
    return formatDateFull(startDateStr);
  }

  const locale = getDateLocale();

  // Check if same month and year
  const sameMonth = startDate.getMonth() === endDate.getMonth();
  const sameYear = startDate.getFullYear() === endDate.getFullYear();

  if (sameMonth && sameYear) {
    // Compact format: "Mar 10 - 15, 2026"
    const startDay = startDate.getDate();
    const endDay = endDate.getDate();
    return `${startDate.toLocaleDateString(locale, { month: 'short' })} ${startDay} - ${endDay}, ${startDate.getFullYear()}`;
  }

  // Full format: "Mar 10, 2026 - Apr 15, 2026"
  return `${formatDateFull(startDateStr)} - ${formatDateFull(endDateStr)}`;
};

/**
 * Format a date range without year (for itinerary headers)
 * Example: "Mar 10 - Mar 15" or "Mar 10 - 15" if same month
 */
export const formatDateRangeShort = (startDateStr, endDateStr) => {
  if (!startDateStr) return '';

  const startDate = new Date(startDateStr);
  if (isNaN(startDate.getTime())) return '';

  if (!endDateStr) {
    return formatDateShort(startDateStr);
  }

  const endDate = new Date(endDateStr);
  if (isNaN(endDate.getTime())) {
    return formatDateShort(startDateStr);
  }

  const locale = getDateLocale();

  // Check if same month
  const sameMonth = startDate.getMonth() === endDate.getMonth();

  if (sameMonth) {
    // Compact format: "Mar 10 - 15"
    const month = startDate.toLocaleDateString(locale, { month: 'short' });
    return `${month} ${startDate.getDate()} - ${endDate.getDate()}`;
  }

  // Full format: "Mar 10 - Apr 15"
  return `${formatDateShort(startDateStr)} - ${formatDateShort(endDateStr)}`;
};

/**
 * Format a date for display in document lists and timestamps
 * Example: "Mar 10, 2026" with optional time
 */
export const formatDateForDocument = (dateStr, includeTime = false) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';

  const locale = getDateLocale();

  const options = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  };

  if (includeTime) {
    options.hour = 'numeric';
    options.minute = '2-digit';
  }

  return date.toLocaleDateString(locale, options);
};

/**
 * Check if two date ranges overlap
 * Note: Same-day arrival/departure is allowed (leaving one place, arriving at another)
 * @param {string} start1 - Start date of first range (YYYY-MM-DD)
 * @param {string} end1 - End date of first range (YYYY-MM-DD)
 * @param {string} start2 - Start date of second range (YYYY-MM-DD)
 * @param {string} end2 - End date of second range (YYYY-MM-DD)
 * @returns {boolean} True if ranges overlap
 */
export const doDateRangesOverlap = (start1, end1, start2, end2) => {
  if (!start1 || !end1 || !start2 || !end2) return false;

  const s1 = new Date(start1);
  const e1 = new Date(end1);
  const s2 = new Date(start2);
  const e2 = new Date(end2);

  // Check for invalid dates
  if ([s1, e1, s2, e2].some(d => isNaN(d.getTime()))) return false;

  // Two ranges overlap if one starts before the other ends
  // Allow same-day: arrival at new place can be on departure day from previous place
  // So we use < instead of <= for the boundary check
  return s1 < e2 && s2 < e1;
};

/**
 * Find all destinations that have date collisions with a given date range
 * @param {string} arrivalDate - Arrival date (YYYY-MM-DD)
 * @param {string} departureDate - Departure date (YYYY-MM-DD)
 * @param {Array} existingDestinations - Array of destination objects with arrival_date and departure_date
 * @param {string|null} excludeId - Destination ID to exclude (for edit mode)
 * @returns {Array} Array of destinations that have date collisions
 */
export const findDateCollisions = (arrivalDate, departureDate, existingDestinations, excludeId = null) => {
  if (!arrivalDate || !departureDate || !existingDestinations?.length) return [];

  return existingDestinations.filter(dest => {
    // Skip the destination being edited
    if (excludeId && dest.id === excludeId) return false;

    return doDateRangesOverlap(
      arrivalDate,
      departureDate,
      dest.arrival_date,
      dest.departure_date
    );
  });
};

/**
 * Parse a date string (YYYY-MM-DD) into a Date object in local timezone.
 * This avoids timezone issues that occur when using new Date(dateStr) which
 * parses as UTC and can cause off-by-one day errors.
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {Date|null} Date object in local timezone, or null if invalid
 */
export const parseDateString = (dateStr) => {
  if (!dateStr) return null;

  // Handle Date objects that might be passed in
  if (dateStr instanceof Date) {
    return isNaN(dateStr.getTime()) ? null : dateStr;
  }

  // Parse YYYY-MM-DD format
  const parts = String(dateStr).split('-');
  if (parts.length !== 3) return null;

  const [year, month, day] = parts.map(Number);

  // Validate parts
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  // Create date in local timezone (month is 0-indexed)
  const date = new Date(year, month - 1, day);

  // Validate the date is real (handles cases like Feb 30)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return date;
};

/**
 * Calculate the day number for a given date relative to a start date.
 * Day 1 is the start date itself.
 * @param {string|Date} targetDate - The date to calculate day number for
 * @param {string|Date} startDate - The start/arrival date of the trip
 * @returns {number|null} Day number (1-based), or null if invalid
 */
export const calculateDayNumber = (targetDate, startDate) => {
  const target = parseDateString(targetDate);
  const start = parseDateString(startDate);

  if (!target || !start) return null;

  // Reset time components to midnight for accurate day calculation
  const targetMidnight = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const startMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate());

  const diffMs = targetMidnight - startMidnight;
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  return diffDays + 1; // Day 1 is the start date
};
