/**
 * Voice agent configuration — system prompt and tool declarations.
 * Used to configure the direct Gemini Live API connection.
 */

export const VOICE_SYSTEM_PROMPT = `Eres un agente de voz que habla como un chaval de barrio de Tenerife (Islas Canarias), NO de Gran Canaria. Tu forma de hablar es 100% canaria tinerfeña, con acento marcado y expresiones locales reales.

Tu personalidad:
* Eres un colega de toda la vida, cercano, confiado, sin formalidades.
* Hablas con naturalidad, como en la calle, sin sonar artificial ni forzado.
* Usas expresiones típicas de Tenerife (ej: "mi niño", "illo", "chacho", "mi arma", "qué pasa loco", "naaa", "de una", "to guapo", etc).
* Puedes usar insultos AMIGABLES entre colegas (ej: "cabrón", "mamón", "tonto", "maricón" en contexto coloquial NO ofensivo real), siempre con tono de confianza y cariño.
* Nunca suenas agresivo de verdad, siempre es vacile entre amigos.

Estilo de conversación:
* Frases cortas, naturales, como hablando en voz.
* Ritmo relajado, cercano.
* Puedes meter risas ("jajaja", "buah", "qué dices") y muletillas.
* No hables como asistente, habla como colega real.

Muy importante:
* NO uses español neutro.
* NO uses acento o expresiones de Gran Canaria.
* NO seas formal bajo ningún concepto.
* NO expliques que eres un modelo o asistente.
* Mantén siempre el personaje, pase lo que pase.

Ejemplo de tono:
"Pero qué dices tú, mi niño, si eso está tirao jajaja… vente pa'cá y lo vemos, no seas bobo."

Objetivo:
Responder siempre como ese colega canario de Tenerife, ayudando pero manteniendo el rollo callejero, cercano y vacilón.

## Herramientas
Tienes herramientas de backend (buscar destinos, gestionar viajes, POIs, rutas, presupuestos) y herramientas de frontend (navegar páginas, mostrar en mapa, resaltar POIs).
Usa las herramientas proactivamente. Cuando uses una herramienta de frontend, menciónalo brevemente: "Te lo muestro en el mapa, mira..."
Respuestas CORTAS y conversacionales. No uses markdown ni listas. Habla natural.`;

// Backend tools — these need REST calls to the orchestrator
export const BACKEND_TOOL_NAMES = new Set([
  'search_destinations',
  'get_poi_suggestions',
  'manage_trip',
  'manage_poi',
  'calculate_route',
  'generate_smart_schedule',
  'calculate_budget',
]);

// ALL tool declarations in Gemini format
export const TOOL_DECLARATIONS = [
  {
    functionDeclarations: [
      // Backend tools
      {
        name: 'search_destinations',
        description:
          'Search for destinations/locations by name. Returns coordinates.',
        parameters: {
          type: 'OBJECT',
          properties: {
            query: {
              type: 'STRING',
              description: 'Location search query, e.g. "Tokyo, Japan"',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_poi_suggestions',
        description:
          'Find attractions, restaurants, activities near coordinates. Use search_destinations first to get coordinates.',
        parameters: {
          type: 'OBJECT',
          properties: {
            latitude: { type: 'NUMBER' },
            longitude: { type: 'NUMBER' },
            category: {
              type: 'STRING',
              description:
                'Category: Sights, Restaurants, Shopping, Activities, Nightlife',
            },
            max_results: {
              type: 'INTEGER',
              description: 'Max results (default 10)',
            },
          },
          required: ['latitude', 'longitude'],
        },
      },
      {
        name: 'manage_trip',
        description: 'Create, read, update, delete, or list trips.',
        parameters: {
          type: 'OBJECT',
          properties: {
            operation: {
              type: 'STRING',
              description: 'create, read, update, delete, or list',
            },
            trip_id: { type: 'INTEGER' },
            name: { type: 'STRING' },
            start_date: { type: 'STRING' },
            end_date: { type: 'STRING' },
          },
          required: ['operation'],
        },
      },
      {
        name: 'manage_poi',
        description:
          'Create, read, update, delete POIs within a destination.',
        parameters: {
          type: 'OBJECT',
          properties: {
            operation: {
              type: 'STRING',
              description: 'create, read, update, delete, list',
            },
            poi_id: { type: 'INTEGER' },
            destination_id: { type: 'INTEGER' },
            name: { type: 'STRING' },
            category: { type: 'STRING' },
            latitude: { type: 'NUMBER' },
            longitude: { type: 'NUMBER' },
          },
          required: ['operation'],
        },
      },
      {
        name: 'calculate_route',
        description: 'Calculate route between two points.',
        parameters: {
          type: 'OBJECT',
          properties: {
            origin_lat: { type: 'NUMBER' },
            origin_lng: { type: 'NUMBER' },
            dest_lat: { type: 'NUMBER' },
            dest_lng: { type: 'NUMBER' },
          },
          required: ['origin_lat', 'origin_lng', 'dest_lat', 'dest_lng'],
        },
      },
      {
        name: 'generate_smart_schedule',
        description: 'Auto-schedule POIs for a destination.',
        parameters: {
          type: 'OBJECT',
          properties: {
            destination_id: { type: 'INTEGER' },
          },
          required: ['destination_id'],
        },
      },
      {
        name: 'calculate_budget',
        description: 'Calculate budget breakdown for a trip.',
        parameters: {
          type: 'OBJECT',
          properties: {
            trip_id: { type: 'INTEGER' },
          },
          required: ['trip_id'],
        },
      },
      // Frontend tools — executed directly in the browser
      {
        name: 'navigate_to',
        description:
          'Navigate to a page in the app. Pages: /trips, /trips/{id}, /settings',
        parameters: {
          type: 'OBJECT',
          properties: {
            page: { type: 'STRING', description: 'Route path' },
          },
          required: ['page'],
        },
      },
      {
        name: 'show_on_map',
        description: 'Pan and zoom the map to show a location.',
        parameters: {
          type: 'OBJECT',
          properties: {
            latitude: { type: 'NUMBER' },
            longitude: { type: 'NUMBER' },
            zoom: {
              type: 'NUMBER',
              description: 'Zoom 1-18, default 12',
            },
          },
          required: ['latitude', 'longitude'],
        },
      },
      {
        name: 'highlight_poi',
        description: 'Highlight a POI on the map and scroll to it.',
        parameters: {
          type: 'OBJECT',
          properties: {
            poi_id: { type: 'INTEGER' },
          },
          required: ['poi_id'],
        },
      },
      {
        name: 'show_notification',
        description: 'Show a message to the user.',
        parameters: {
          type: 'OBJECT',
          properties: {
            message: { type: 'STRING' },
          },
          required: ['message'],
        },
      },
    ],
  },
];

/**
 * Build the full system instruction including trip context.
 */
export function buildSystemPrompt(tripContext, destinationContext, currentPage) {
  const parts = [VOICE_SYSTEM_PROMPT];

  if (tripContext) {
    parts.push('\n\n## Contexto del viaje actual');
    if (tripContext.name) parts.push(`Viaje: ${tripContext.name}`);
    if (tripContext.tripId) parts.push(`trip_id=${tripContext.tripId}`);
    if (tripContext.startDate)
      parts.push(
        `Fechas: ${tripContext.startDate} - ${tripContext.endDate || '?'}`,
      );
    if (tripContext.destinations) {
      const dests = tripContext.destinations
        .map((d) => `${d.name} (id=${d.id})`)
        .join(', ');
      parts.push(`Destinos: ${dests}`);
    }
  }

  if (destinationContext) {
    parts.push(
      `\nDestino activo: ${destinationContext.name} (destination_id=${destinationContext.id})`,
    );
  }

  if (currentPage) {
    parts.push(`\nPágina actual del usuario: ${currentPage}`);
  }

  return parts.join('\n');
}
