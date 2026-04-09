import authFetch from './authFetch';
import {
  createTripOverviewBlock,
  createDayRouteBlock,
  createDestinationOverviewBlock,
  serializeRouteBlock,
} from './routeBlockContract';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function nightsBetween(arrival, departure) {
  if (!arrival || !departure) return null;
  try {
    const a = new Date(arrival + 'T00:00:00');
    const d = new Date(departure + 'T00:00:00');
    const diff = Math.round((d - a) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : null;
  } catch {
    return null;
  }
}

function escapeCell(value) {
  if (value == null || value === '') return '—';
  return String(value).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

/**
 * Flatten POIs from grouped API response into a flat array.
 * Handles both `{ items: [{ pois }] }` and direct arrays.
 */
function normalizePois(data) {
  if (Array.isArray(data)) return data;
  if (data?.items && Array.isArray(data.items)) {
    return data.items.flatMap((g) => g.pois || []);
  }
  return [];
}

/**
 * Group POIs by scheduled_date, sort by day_order within each group.
 * Returns Map<dateString|'unscheduled', poi[]> in date order.
 */
function groupPoisByDate(pois) {
  const groups = new Map();

  for (const poi of pois) {
    const key = poi.scheduled_date || 'unscheduled';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(poi);
  }

  // Sort each group by day_order
  for (const [, list] of groups) {
    list.sort((a, b) => (a.day_order ?? Infinity) - (b.day_order ?? Infinity));
  }

  // Sort groups: real dates first (ascending), then 'unscheduled' last
  const sorted = new Map(
    [...groups.entries()].sort(([a], [b]) => {
      if (a === 'unscheduled') return 1;
      if (b === 'unscheduled') return -1;
      return a.localeCompare(b);
    })
  );

  return sorted;
}

// ---------------------------------------------------------------------------
// Scaffold: Trip Overview
// ---------------------------------------------------------------------------

/**
 * Generate a trip overview document with summary, destination list, and budget.
 * @param {Object} trip - Trip object
 * @param {Array} destinations - Array of destination objects
 * @returns {string} Markdown content
 */
export function scaffoldOverviewDocument(trip, destinations) {
  const lines = [];

  lines.push(`# ${trip?.name || 'Trip Overview'}`);
  lines.push('');

  const startDate = formatDate(trip?.start_date);
  const endDate = formatDate(trip?.end_date);
  lines.push(`**Dates**: ${startDate} → ${endDate}`);

  if (trip?.budget_total != null) {
    lines.push(`**Budget**: ${trip.budget_total} ${trip.currency || ''}`);
  }

  lines.push('');

  // Destinations table
  const dests = destinations || [];
  if (dests.length > 0) {
    lines.push('## Destinations');
    lines.push('');
    lines.push('| Destination | Dates | Duration |');
    lines.push('|---|---|---|');

    for (const dest of dests) {
      const name = [dest.city_name, dest.country].filter(Boolean).join(', ');
      const arrival = formatDate(dest.arrival_date);
      const departure = formatDate(dest.departure_date);
      const nights = nightsBetween(dest.arrival_date, dest.departure_date);
      const duration = nights != null ? `${nights} night${nights !== 1 ? 's' : ''}` : '—';
      lines.push(`| ${escapeCell(name)} | ${arrival} → ${departure} | ${duration} |`);
    }

    lines.push('');
  }

  // Trip route block
  if (trip?.id) {
    lines.push('## Trip Route');
    lines.push('');
    const block = serializeRouteBlock(
      createTripOverviewBlock(trip.id, `${trip.name || 'Trip'} Route Overview`)
    );
    lines.push(block);
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Scaffold: Destination Document
// ---------------------------------------------------------------------------

/**
 * Generate a destination document with daily itinerary, POIs, accommodations, and notes.
 * @param {Object} destination - Destination object
 * @param {Array} pois - POIs (flat array)
 * @param {Array} accommodations - Accommodations from the API
 * @param {Array} notes - Notes from the API
 * @returns {string} Markdown content
 */
export function scaffoldDestinationDocument(destination, pois = [], accommodations = [], notes = []) {
  const lines = [];
  const cityName = [destination?.city_name, destination?.country].filter(Boolean).join(', ');

  lines.push(`# ${cityName || 'Destination'}`);
  lines.push('');
  lines.push(`**Dates**: ${formatDate(destination?.arrival_date)} → ${formatDate(destination?.departure_date)}`);
  lines.push('');

  // --- Accommodation section ---
  if (accommodations.length > 0) {
    lines.push('## Accommodation');
    lines.push('');
    lines.push('| Name | Type | Dates | Cost |');
    lines.push('|---|---|---|---|');

    for (const acc of accommodations) {
      const checkIn = formatDate(acc.check_in);
      const checkOut = formatDate(acc.check_out);
      const cost = acc.cost_per_night != null
        ? `${acc.cost_per_night}${acc.currency ? ' ' + acc.currency : ''}/night`
        : '—';
      lines.push(`| ${escapeCell(acc.name)} | ${escapeCell(acc.accommodation_type)} | ${checkIn} → ${checkOut} | ${cost} |`);

      if (acc.booking_reference) {
        lines.push('');
        lines.push(`> Booking ref: ${acc.booking_reference}`);
      }
    }

    lines.push('');
  }

  // --- Daily Itinerary ---
  const poisArray = Array.isArray(pois) ? pois : [];
  if (poisArray.length > 0) {
    const grouped = groupPoisByDate(poisArray);

    lines.push('## Daily Itinerary');
    lines.push('');

    let dayNumber = 1;
    for (const [dateKey, dayPois] of grouped) {
      const isUnscheduled = dateKey === 'unscheduled';
      const heading = isUnscheduled
        ? '### Unscheduled'
        : `### Day ${dayNumber} — ${formatDate(dateKey)}`;
      lines.push(heading);
      lines.push('');
      lines.push('| # | Place | Time | Cost | Notes |');
      lines.push('|---|---|---|---|---|');

      dayPois.forEach((poi, idx) => {
        const duration = poi.duration_minutes != null ? `${poi.duration_minutes}min` : '—';
        const cost = poi.cost_estimate != null ? String(poi.cost_estimate) : '—';
        const poiNotes = escapeCell(poi.notes);
        lines.push(`| ${idx + 1} | ${escapeCell(poi.name)} | ${duration} | ${cost} | ${poiNotes} |`);
      });

      lines.push('');

      // Day route block (only for scheduled days)
      if (!isUnscheduled && destination?.id) {
        const dayLabel = `${destination.city_name || 'Destination'} — ${formatDate(dateKey)} Route`;
        const block = serializeRouteBlock(
          createDayRouteBlock(destination.id, dateKey, dayLabel)
        );
        lines.push(block);
        lines.push('');
      }

      if (!isUnscheduled) dayNumber++;
    }
  }

  // --- Destination overview route ---
  if (destination?.id) {
    lines.push('## Destination Overview Route');
    lines.push('');
    const block = serializeRouteBlock(
      createDestinationOverviewBlock(destination.id, `${destination.city_name || 'Destination'} Route Overview`)
    );
    lines.push(block);
    lines.push('');
  }

  // --- Notes section ---
  if (notes.length > 0) {
    lines.push('## Notes');
    lines.push('');
    for (const note of notes) {
      if (note.title) {
        lines.push(`### ${note.title}`);
      }
      if (note.content) {
        lines.push(note.content);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Fetch + Scaffold
// ---------------------------------------------------------------------------

/**
 * Fetch all data needed and scaffold a document.
 * @param {Object} doc - Document object { id, title, destinationId }
 * @param {Object} trip - Trip object
 * @param {Array} destinations - Array of destination objects
 * @returns {Promise<string>} Generated markdown
 */
export async function fetchAndScaffold(doc, trip, destinations) {
  // Overview document (no destinationId)
  if (!doc?.destinationId) {
    return scaffoldOverviewDocument(trip, destinations);
  }

  const destId = doc.destinationId;
  const destination = (destinations || []).find((d) => d.id === destId) || { id: destId };

  // Fetch POIs, accommodations, and notes in parallel
  const [poisResult, accResult, notesResult] = await Promise.all([
    authFetch(`${API_BASE_URL}/destinations/${destId}/pois?limit=200`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
    authFetch(`${API_BASE_URL}/destinations/${destId}/accommodations?limit=50`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
    authFetch(`${API_BASE_URL}/destinations/${destId}/notes`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
  ]);

  const pois = normalizePois(poisResult);
  const accommodations = accResult?.items || [];
  const notes = (notesResult?.notes || []).filter(
    (n) => n.note_type !== 'export_draft'
  );

  return scaffoldDestinationDocument(destination, pois, accommodations, notes);
}
