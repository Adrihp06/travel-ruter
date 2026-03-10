/**
 * Composes a context-rich AI prompt for a single POI, leveraging
 * day-level route and schedule data when available.
 */

/**
 * @param {object} poi            - The target POI
 * @param {object} destination    - Parent destination (city_name, country, arrival_date, departure_date)
 * @param {object} [dayRoute]     - Day route from useDayRoutesStore (pois, segments, totalDistance, totalDuration)
 * @param {object[]} [accommodations] - Accommodations for the destination
 * @param {object} [trip]         - Trip-level context (name, start_date, end_date)
 * @returns {string} A ready-to-review prompt string
 */
export function formatCurrency(amount, currency = 'EUR') {
  const symbols = { EUR: '\u20AC', USD: '$', GBP: '\u00A3', JPY: '\u00A5' };
  const symbol = symbols[currency] || (currency ? `${currency} ` : '');
  return `${symbol}${Number(amount).toFixed(2)}`;
}

function isFiniteNumber(value) {
  return Number.isFinite(value);
}

export function composePOIPrompt({ poi, destination, dayRoute, accommodations, trip }) {
  const lines = [];

  // Header
  lines.push(`Write an engaging, detailed travel paragraph about "${poi.name}".`);
  lines.push('');

  // POI details
  lines.push('## POI Details');
  lines.push(`- **Name:** ${poi.name}`);
  if (poi.category) lines.push(`- **Category:** ${poi.category}`);
  if (poi.description) lines.push(`- **Description:** ${poi.description}`);
  if (poi.address) lines.push(`- **Address:** ${poi.address}`);
  if (poi.dwell_time) lines.push(`- **Suggested time:** ${poi.dwell_time} minutes`);
  if (poi.estimated_cost != null && poi.estimated_cost > 0) {
    lines.push(`- **Estimated cost:** ~${formatCurrency(poi.estimated_cost, poi.currency)}`);
  }
  if (poi.scheduled_date) {
    lines.push(`- **Scheduled date:** ${poi.scheduled_date}`);
  }

  // Destination context
  if (destination) {
    lines.push('');
    lines.push('## Destination');
    lines.push(`- **City:** ${destination.city_name || destination.name}${destination.country ? `, ${destination.country}` : ''}`);
    if (destination.arrival_date && destination.departure_date) {
      lines.push(`- **Stay:** ${destination.arrival_date} → ${destination.departure_date}`);
    }
  }

  // Day route context (intra-day schedule awareness)
  if (dayRoute && dayRoute.pois && dayRoute.pois.length > 1) {
    lines.push('');
    lines.push('## Day Itinerary');

    const itineraryPois = dayRoute.itineraryPois || dayRoute.pois;
    const poiIndex = itineraryPois.findIndex((p) => p.id === poi.id);
    const routedPoiIndex = dayRoute.pois.findIndex((p) => p.id === poi.id);
    const hasFullRouteCoverage = itineraryPois.length === dayRoute.pois.length;
    const dayPOINames = itineraryPois.map((p) => p.name);
    lines.push(`- **Stops this day:** ${dayPOINames.join(' → ')}`);

    if (poiIndex >= 0) {
      lines.push(`- **Position:** stop ${poiIndex + 1} of ${itineraryPois.length}`);
    }

    if (isFiniteNumber(dayRoute.totalDistance) && dayRoute.totalDistance > 0) {
      lines.push(`- **${hasFullRouteCoverage ? 'Total day distance' : 'Distance across routed stops'}:** ${dayRoute.totalDistance.toFixed(1)} km`);
    }
    if (isFiniteNumber(dayRoute.totalDuration) && dayRoute.totalDuration > 0) {
      lines.push(`- **${hasFullRouteCoverage ? 'Total day travel time' : 'Travel time across routed stops'}:** ${Math.round(dayRoute.totalDuration)} min`);
    }

    // Segment info for this specific POI's legs
    if (dayRoute.segments && routedPoiIndex >= 0) {
      const prevSegment = routedPoiIndex > 0 ? dayRoute.segments[routedPoiIndex - 1] : null;
      const nextSegment = routedPoiIndex < dayRoute.segments.length ? dayRoute.segments[routedPoiIndex] : null;

      if (prevSegment && isFiniteNumber(prevSegment.distance) && isFiniteNumber(prevSegment.duration)) {
        lines.push(
          `- **From previous stop** (${prevSegment.fromPoi?.name}): ${prevSegment.distance?.toFixed(1)} km, ~${Math.round(prevSegment.duration || 0)} min by ${prevSegment.mode}`
        );
      }
      if (nextSegment && isFiniteNumber(nextSegment.distance) && isFiniteNumber(nextSegment.duration)) {
        lines.push(
          `- **To next stop** (${nextSegment.toPoi?.name}): ${nextSegment.distance?.toFixed(1)} km, ~${Math.round(nextSegment.duration || 0)} min by ${nextSegment.mode}`
        );
      }
    }
  }

  // Accommodation context
  if (accommodations && accommodations.length > 0) {
    lines.push('');
    lines.push('## Accommodation');
    accommodations.forEach((acc) => {
      const dates = [acc.check_in_date, acc.check_out_date].filter(Boolean).join(' → ');
      lines.push(`- ${acc.name}${dates ? ` (${dates})` : ''}${acc.address ? ` — ${acc.address}` : ''}`);
    });
  }

  // Trip context
  if (trip) {
    lines.push('');
    lines.push('## Trip');
    lines.push(`- **Trip:** ${trip.name}`);
    if (trip.start_date && trip.end_date) {
      lines.push(`- **Dates:** ${trip.start_date} → ${trip.end_date}`);
    }
  }

  lines.push('');
  lines.push('Use the context above to write a vivid, practical travel paragraph. Include tips, atmosphere, and how this stop fits into the day.');

  return lines.join('\n');
}
