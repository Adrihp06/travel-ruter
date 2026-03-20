/**
 * Discovery and intelligence MCP tools — geocoding, POI suggestions, weather, trip summary, packing list
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getClient } from '../api/client.js';
import type { POIResponse, AccommodationResponse } from '../types/schemas.js';

export function registerDiscoveryTools(server: McpServer): void {

  // ============================================================================
  // Search / Geocoding
  // ============================================================================

  server.registerTool(
    'search_location',
    {
      title: 'Search Location',
      description:
        'Search for a place by name and get coordinates. Use this before adding destinations or POIs ' +
        'when you don\'t know the latitude/longitude. Examples: "Colosseum, Rome", "Florence, Italy", "JFK Airport".',
      inputSchema: {
        query: z.string().min(2).describe('Place name to search for (required)'),
        limit: z.number().int().min(1).max(10).default(3).describe('Max results (default: 3)'),
      },
    },
    async (args) => {
      try {
        const client = getClient();
        const results = await client.searchLocations(args.query, args.limit);
        if (results.length === 0) {
          return { content: [{ type: 'text' as const, text: `No results found for "${args.query}".` }] };
        }
        const summary = results.map((r, i) =>
          `${i + 1}. ${r.display_name}\n   lat: ${r.latitude}, lng: ${r.longitude} (type: ${r.type})`
        ).join('\n');
        return { content: [{ type: 'text' as const, text: summary }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error searching location: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================================================
  // POI Suggestions
  // ============================================================================

  server.registerTool(
    'suggest_pois',
    {
      title: 'Suggest POIs',
      description:
        'Get POI suggestions (restaurants, museums, attractions) near a destination. ' +
        'Requires Google Places API key configured on the backend. Returns rated suggestions with addresses and estimated costs.',
      inputSchema: {
        destination_id: z.number().int().positive().describe('Destination ID to get suggestions for (required)'),
        category: z.string().optional().describe('Filter by category: restaurant, museum, attraction, park, etc.'),
        trip_type: z.string().optional().describe('Trip style: romantic, adventure, family, cultural, food'),
        radius: z.number().int().min(500).max(50000).default(5000).describe('Search radius in meters (default: 5000)'),
        max_results: z.number().int().min(1).max(50).default(10).describe('Max suggestions (default: 10)'),
      },
    },
    async (args) => {
      try {
        const client = getClient();
        const suggestions = await client.getPoiSuggestions(args.destination_id, {
          radius: args.radius,
          category_filter: args.category,
          trip_type: args.trip_type,
          max_results: args.max_results,
        });

        if (suggestions.length === 0) {
          return { content: [{ type: 'text' as const, text: 'No POI suggestions found. The Google Places API key may not be configured.' }] };
        }

        const summary = suggestions.map((s, i) => {
          const rating = s.metadata?.rating ? `⭐ ${s.metadata.rating}` : '';
          const reviews = s.metadata?.user_ratings_total ? `(${s.metadata.user_ratings_total} reviews)` : '';
          const meta = [rating, reviews].filter(Boolean).join(' ');
          return `${i + 1}. **${s.name}** (${s.category}) ${meta}\n   ${s.address || 'No address'}\n   lat: ${s.latitude}, lng: ${s.longitude}`;
        }).join('\n\n');

        return { content: [{ type: 'text' as const, text: summary }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error getting POI suggestions: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================================================
  // Weather Forecast
  // ============================================================================

  server.registerTool(
    'get_weather',
    {
      title: 'Get Weather',
      description:
        'Get average historical weather for a destination during a specific month. ' +
        'Useful for planning outdoor activities and packing. Uses Open-Meteo historical data.',
      inputSchema: {
        destination_id: z.number().int().positive().describe('Destination ID (required)'),
        month: z.number().int().min(1).max(12).optional().describe('Month (1-12). Defaults to the destination arrival month.'),
      },
    },
    async (args) => {
      try {
        const client = getClient();
        const weather = await client.getDestinationWeather(args.destination_id, args.month);
        if (weather.average_temperature !== null) {
          return {
            content: [{
              type: 'text' as const,
              text: weather.display_text + ` (${(weather.average_temperature * 9/5 + 32).toFixed(1)}°F)`,
            }],
          };
        }
        return { content: [{ type: 'text' as const, text: 'Weather data not available for this destination/month.' }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error getting weather: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================================================
  // Trip Summary (day-by-day itinerary)
  // ============================================================================

  server.registerTool(
    'get_trip_summary',
    {
      title: 'Get Trip Summary',
      description:
        'Get a human-readable day-by-day trip itinerary with POIs, accommodations, and costs per destination. ' +
        'Aggregates all trip data into a single formatted summary.',
      inputSchema: {
        trip_id: z.number().int().positive().describe('Trip ID (required)'),
      },
    },
    async (args) => {
      try {
        const client = getClient();
        const trip = await client.getTrip(args.trip_id);
        const budget = await client.getTripBudget(args.trip_id);

        const lines: string[] = [];
        lines.push(`# ${trip.name}`);
        lines.push(`📍 ${trip.location || 'No location'} · ${trip.start_date} → ${trip.end_date} (${trip.nights} nights)`);
        lines.push(`💰 Budget: €${budget.estimated_total} / €${budget.total_budget} (${budget.budget_percentage?.toFixed(0)}% allocated)`);
        lines.push(`   POIs: €${budget.poi_estimated} · Accommodation: €${budget.accommodation_total} · Remaining: €${budget.remaining_budget}`);
        lines.push('');

        for (const dest of trip.destinations || []) {
          lines.push(`## ${dest.city_name}${dest.country ? ', ' + dest.country : ''}`);
          lines.push(`📅 ${dest.arrival_date} → ${dest.departure_date}`);

          // Fetch POIs and accommodations for this destination
          let pois: POIResponse[] = [];
          try {
            const poisByCategory = await client.listPOIs(dest.id);
            pois = poisByCategory.flatMap(c => c.pois || []);
          } catch { /* ignore */ }

          let accommodations: AccommodationResponse[] = [];
          try {
            accommodations = await client.listAccommodations(dest.id);
          } catch { /* ignore */ }

          if (accommodations.length > 0) {
            for (const acc of accommodations) {
              lines.push(`🏨 ${acc.name} (${acc.type}) — €${acc.total_cost || '?'} · ${acc.check_in_date} → ${acc.check_out_date}`);
            }
          }

          // Group POIs by scheduled_date
          const byDate = new Map<string, POIResponse[]>();
          const unscheduled: POIResponse[] = [];
          for (const poi of pois) {
            if (poi.scheduled_date) {
              const existing = byDate.get(poi.scheduled_date) || [];
              existing.push(poi);
              byDate.set(poi.scheduled_date, existing);
            } else {
              unscheduled.push(poi);
            }
          }

          const sortedDates = [...byDate.keys()].sort();
          for (const date of sortedDates) {
            const dayPois = byDate.get(date)!.sort((a, b) => (a.day_order || 0) - (b.day_order || 0));
            lines.push(`  📅 ${date}:`);
            for (const poi of dayPois) {
              const cost = poi.estimated_cost ? `€${poi.estimated_cost}` : 'free';
              const time = poi.dwell_time ? `${poi.dwell_time}min` : '';
              lines.push(`    • ${poi.name} (${poi.category}) — ${cost}${time ? ' · ' + time : ''}`);
            }
          }

          if (unscheduled.length > 0) {
            lines.push(`  📋 Unscheduled:`);
            for (const poi of unscheduled) {
              lines.push(`    • ${poi.name} (${poi.category})`);
            }
          }

          lines.push('');
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error generating trip summary: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================================================
  // Packing Suggestions
  // ============================================================================

  server.registerTool(
    'get_packing_suggestions',
    {
      title: 'Get Packing Suggestions',
      description:
        'Generate packing suggestions based on the trip\'s destinations, activities, weather, and duration. ' +
        'Analyzes POI categories and destination types to recommend what to bring.',
      inputSchema: {
        trip_id: z.number().int().positive().describe('Trip ID (required)'),
      },
    },
    async (args) => {
      try {
        const client = getClient();
        const trip = await client.getTrip(args.trip_id);

        // Collect all POI categories across destinations
        const categories = new Set<string>();
        for (const dest of trip.destinations || []) {
          try {
            const poisByCategory = await client.listPOIs(dest.id);
            for (const cat of poisByCategory) {
              categories.add(cat.category.toLowerCase());
            }
          } catch { /* ignore */ }
        }

        // Collect weather data for each destination
        const weatherInfo: string[] = [];
        for (const dest of trip.destinations || []) {
          try {
            const weather = await client.getDestinationWeather(dest.id);
            if (weather.average_temperature !== null) {
              weatherInfo.push(`${dest.city_name}: ~${weather.average_temperature.toFixed(0)}°C`);
            }
          } catch { /* ignore */ }
        }

        const lines: string[] = [];
        lines.push(`# Packing Suggestions for ${trip.name}`);
        lines.push(`${trip.nights} nights · ${trip.start_date} → ${trip.end_date}`);
        lines.push('');

        if (weatherInfo.length > 0) {
          lines.push(`## 🌡️ Expected Weather`);
          lines.push(weatherInfo.join(' · '));
          lines.push('');
        }

        lines.push('## 👕 Essentials');
        lines.push('- Passport & copies of travel documents');
        lines.push('- Travel insurance details');
        lines.push(`- ${Math.min(trip.nights, 7)} changes of clothes (with laundry access)`);
        lines.push('- Comfortable walking shoes');
        lines.push('- Phone charger & power adapter (Type L for Italy, Type G for UK, etc.)');
        lines.push('- Reusable water bottle');

        // Activity-based suggestions
        const activityItems: string[] = [];
        if (categories.has('activity') || categories.has('park') || categories.has('nature')) {
          activityItems.push('- Hiking shoes or sturdy sneakers');
          activityItems.push('- Daypack / small backpack');
          activityItems.push('- Sunscreen & hat');
        }
        if (categories.has('restaurant') || categories.has('nightlife')) {
          activityItems.push('- Smart casual outfit for nice dinners');
        }
        if (categories.has('museum') || categories.has('attraction')) {
          activityItems.push('- Shoulder cover/scarf (for churches & religious sites)');
          activityItems.push('- Knee-length clothing (dress codes at religious sites)');
        }
        if (categories.has('shopping')) {
          activityItems.push('- Extra bag/space in luggage for souvenirs');
        }
        if (categories.has('beach') || categories.has('swimming')) {
          activityItems.push('- Swimsuit & beach towel');
          activityItems.push('- Waterproof phone pouch');
        }

        if (activityItems.length > 0) {
          lines.push('');
          lines.push('## 🎒 Activity-Specific');
          lines.push(...activityItems);
        }

        lines.push('');
        lines.push('## 💊 Health & Safety');
        lines.push('- Any prescription medications');
        lines.push('- Basic first aid (band-aids, pain relief)');
        lines.push('- Hand sanitizer');

        lines.push('');
        lines.push('## 📱 Tech');
        lines.push('- Phone + charger');
        lines.push('- Camera (or rely on phone)');
        lines.push('- Portable battery pack');
        lines.push('- Offline maps downloaded');

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error generating packing suggestions: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );
}
