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

/**
 * Get the user's preferred date locale from settings
 * Falls back to browser locale if not set
 */
export const getDateLocale = () => {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const settings = JSON.parse(stored);
      if (settings.dateFormat?.locale) {
        return settings.dateFormat.locale;
      }
    }
  } catch {
    // Ignore errors
  }
  // Fall back to browser locale or 'en-US'
  return navigator.language || 'en-US';
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
    const monthYear = startDate.toLocaleDateString(locale, {
      month: 'short',
      year: 'numeric',
    });
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
