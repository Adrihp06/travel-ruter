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

function getPromptCopy(language) {
  const isSpanish = typeof language === 'string' && language.toLowerCase().startsWith('es');

  if (isSpanish) {
    return {
      intro: (name) => `Redacta un texto de viaje evocador y util sobre "${name}".`,
      poiDetails: '## Detalles del lugar',
      destination: '## Destino',
      dayItinerary: '## Itinerario del dia',
      accommodation: '## Alojamiento',
      trip: '## Viaje',
      name: 'Nombre',
      category: 'Categoria',
      description: 'Descripcion',
      address: 'Direccion',
      suggestedTime: 'Tiempo recomendado',
      estimatedCost: 'Coste estimado',
      scheduledDate: 'Fecha prevista',
      city: 'Ciudad',
      stay: 'Estancia',
      stops: 'Paradas del dia',
      position: 'Posicion',
      totalDayDistance: 'Distancia total del dia',
      routedDistance: 'Distancia entre paradas con ruta',
      totalDayTravelTime: 'Tiempo total de desplazamiento del dia',
      routedTravelTime: 'Tiempo de desplazamiento entre paradas con ruta',
      fromPrevious: 'Desde la parada anterior',
      toNext: 'Hasta la siguiente parada',
      tripLabel: 'Viaje',
      dates: 'Fechas',
      stopWord: 'parada',
      stopWordPlural: 'paradas',
      minutes: 'minutos',
      closing: 'Usa el contexto anterior para escribir un texto narrativo, practico y coherente con el resto del dia. Incluye ambiente, consejos y como encaja esta parada en la experiencia del viaje.',
    };
  }

  return {
    intro: (name) => `Write an engaging, detailed travel paragraph about "${name}".`,
    poiDetails: '## POI Details',
    destination: '## Destination',
    dayItinerary: '## Day Itinerary',
    accommodation: '## Accommodation',
    trip: '## Trip',
    name: 'Name',
    category: 'Category',
    description: 'Description',
    address: 'Address',
    suggestedTime: 'Suggested time',
    estimatedCost: 'Estimated cost',
    scheduledDate: 'Scheduled date',
    city: 'City',
    stay: 'Stay',
    stops: 'Stops this day',
    position: 'Position',
    totalDayDistance: 'Total day distance',
    routedDistance: 'Distance across routed stops',
    totalDayTravelTime: 'Total day travel time',
    routedTravelTime: 'Travel time across routed stops',
    fromPrevious: 'From previous stop',
    toNext: 'To next stop',
    tripLabel: 'Trip',
    dates: 'Dates',
    stopWord: 'stop',
    stopWordPlural: 'stops',
    minutes: 'minutes',
    closing: 'Use the context above to write a vivid, practical travel paragraph. Include tips, atmosphere, and how this stop fits into the day.',
  };
}

export function composePOIPrompt({ poi, destination, dayRoute, accommodations, trip, language = 'en' }) {
  const copy = getPromptCopy(language);
  const lines = [];

  // Header
  lines.push(copy.intro(poi.name));
  lines.push('');

  // POI details
  lines.push(copy.poiDetails);
  lines.push(`- **${copy.name}:** ${poi.name}`);
  if (poi.category) lines.push(`- **${copy.category}:** ${poi.category}`);
  if (poi.description) lines.push(`- **${copy.description}:** ${poi.description}`);
  if (poi.address) lines.push(`- **${copy.address}:** ${poi.address}`);
  if (poi.dwell_time) lines.push(`- **${copy.suggestedTime}:** ${poi.dwell_time} ${copy.minutes}`);
  if (poi.estimated_cost != null && poi.estimated_cost > 0) {
    lines.push(`- **${copy.estimatedCost}:** ~${formatCurrency(poi.estimated_cost, poi.currency)}`);
  }
  if (poi.scheduled_date) {
    lines.push(`- **${copy.scheduledDate}:** ${poi.scheduled_date}`);
  }

  // Destination context
  if (destination) {
    lines.push('');
    lines.push(copy.destination);
    lines.push(`- **${copy.city}:** ${destination.city_name || destination.name}${destination.country ? `, ${destination.country}` : ''}`);
    if (destination.arrival_date && destination.departure_date) {
      lines.push(`- **${copy.stay}:** ${destination.arrival_date} → ${destination.departure_date}`);
    }
  }

  // Day route context (intra-day schedule awareness)
  if (dayRoute && dayRoute.pois && dayRoute.pois.length > 1) {
    lines.push('');
    lines.push(copy.dayItinerary);

    const itineraryPois = dayRoute.itineraryPois || dayRoute.pois;
    const poiIndex = itineraryPois.findIndex((p) => p.id === poi.id);
    const routedPoiIndex = dayRoute.pois.findIndex((p) => p.id === poi.id);
    const hasFullRouteCoverage = itineraryPois.length === dayRoute.pois.length;
    const dayPOINames = itineraryPois.map((p) => p.name);
    lines.push(`- **${copy.stops}:** ${dayPOINames.join(' → ')}`);

    if (poiIndex >= 0) {
      const stopLabel = itineraryPois.length === 1 ? copy.stopWord : copy.stopWordPlural;
      lines.push(`- **${copy.position}:** ${copy.stopWord} ${poiIndex + 1} ${copy.stopWord === 'parada' ? 'de' : 'of'} ${itineraryPois.length} ${stopLabel}`);
    }

    if (isFiniteNumber(dayRoute.totalDistance) && dayRoute.totalDistance > 0) {
      lines.push(`- **${hasFullRouteCoverage ? copy.totalDayDistance : copy.routedDistance}:** ${dayRoute.totalDistance.toFixed(1)} km`);
    }
    if (isFiniteNumber(dayRoute.totalDuration) && dayRoute.totalDuration > 0) {
      lines.push(`- **${hasFullRouteCoverage ? copy.totalDayTravelTime : copy.routedTravelTime}:** ${Math.round(dayRoute.totalDuration)} min`);
    }

    // Segment info for this specific POI's legs
    if (dayRoute.segments && routedPoiIndex >= 0) {
      const prevSegment = routedPoiIndex > 0 ? dayRoute.segments[routedPoiIndex - 1] : null;
      const nextSegment = routedPoiIndex < dayRoute.segments.length ? dayRoute.segments[routedPoiIndex] : null;

      if (prevSegment && isFiniteNumber(prevSegment.distance) && isFiniteNumber(prevSegment.duration)) {
        lines.push(
          `- **${copy.fromPrevious}** (${prevSegment.fromPoi?.name}): ${prevSegment.distance?.toFixed(1)} km, ~${Math.round(prevSegment.duration || 0)} min by ${prevSegment.mode}`
        );
      }
      if (nextSegment && isFiniteNumber(nextSegment.distance) && isFiniteNumber(nextSegment.duration)) {
        lines.push(
          `- **${copy.toNext}** (${nextSegment.toPoi?.name}): ${nextSegment.distance?.toFixed(1)} km, ~${Math.round(nextSegment.duration || 0)} min by ${nextSegment.mode}`
        );
      }
    }
  }

  // Accommodation context
  if (accommodations && accommodations.length > 0) {
    lines.push('');
    lines.push(copy.accommodation);
    accommodations.forEach((acc) => {
      const dates = [acc.check_in_date, acc.check_out_date].filter(Boolean).join(' → ');
      lines.push(`- ${acc.name}${dates ? ` (${dates})` : ''}${acc.address ? ` — ${acc.address}` : ''}`);
    });
  }

  // Trip context
  if (trip) {
    lines.push('');
    lines.push(copy.trip);
    lines.push(`- **${copy.tripLabel}:** ${trip.name}`);
    if (trip.start_date && trip.end_date) {
      lines.push(`- **${copy.dates}:** ${trip.start_date} → ${trip.end_date}`);
    }
  }

  lines.push('');
  lines.push(copy.closing);

  return lines.join('\n');
}
