/**
 * Batch and convenience operations MCP tools
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getClient } from '../api/client.js';
import type { TripCreate, DestinationCreate, TripResponse, DestinationResponse, POICreate, POIResponse } from '../types/schemas.js';

// Destination input schema (without trip_id, since it will be set after trip creation)
const destinationInputSchema = z.object({
  city_name: z.string().min(1).max(255).describe('City name (required)'),
  country: z.string().max(255).optional().describe('Country name'),
  arrival_date: z.string().describe('Arrival date (YYYY-MM-DD format, required)'),
  departure_date: z.string().describe('Departure date (YYYY-MM-DD format, required)'),
  latitude: z.number().min(-90).max(90).optional().describe('Latitude coordinate'),
  longitude: z.number().min(-180).max(180).optional().describe('Longitude coordinate'),
  description: z.string().optional().describe('Destination description'),
  notes: z.string().optional().describe('Additional notes'),
});

interface CreateTripWithDestinationsResult {
  trip: TripResponse;
  destinations: DestinationResponse[];
}

interface DuplicateTripResult {
  original_trip_id: number;
  new_trip: TripResponse;
  destinations: DestinationResponse[];
}

// POI input schema (without destination_id, since it's set from the parent parameter)
const poiInputSchema = z.object({
  name: z.string().min(1).max(255).describe('POI name (required)'),
  category: z.string().min(1).max(100).describe('Category: restaurant, museum, attraction, activity, shopping, etc. (required)'),
  description: z.string().optional().describe('POI description'),
  address: z.string().max(500).optional().describe('Street address'),
  latitude: z.number().min(-90).max(90).optional().describe('Latitude'),
  longitude: z.number().min(-180).max(180).optional().describe('Longitude'),
  estimated_cost: z.number().min(0).optional().describe('Estimated cost'),
  currency: z.string().length(3).default('USD').describe('Currency code'),
  dwell_time: z.number().int().min(0).optional().describe('Time to spend in minutes'),
  priority: z.number().int().min(0).default(0).describe('Priority (higher = more important)'),
  scheduled_date: z.string().optional().describe('Scheduled visit date (YYYY-MM-DD)'),
  day_order: z.number().int().min(0).optional().describe('Order within the scheduled day'),
  external_id: z.string().optional().describe('External reference ID'),
  external_source: z.string().optional().describe('Source of external ID'),
});

interface AddPoisBatchResult {
  destination_id: number;
  created: POIResponse[];
  total_estimated_cost: number;
}

export function registerBatchTools(server: McpServer): void {
  // Create Trip with Destinations
  server.registerTool(
    'create_trip_with_destinations',
    {
      title: 'Create Trip with Destinations',
      description: 'Create a new trip with initial destinations in a single operation. This is more efficient than creating the trip and destinations separately.',
      inputSchema: {
        // Trip fields
        name: z.string().min(1).max(255).describe('Trip name (required)'),
        location: z.string().max(255).optional().describe('Trip location/region'),
        latitude: z.number().min(-90).max(90).optional().describe('Trip latitude coordinate'),
        longitude: z.number().min(-180).max(180).optional().describe('Trip longitude coordinate'),
        description: z.string().optional().describe('Trip description'),
        cover_image: z.string().max(500).optional().describe('Cover image URL'),
        start_date: z.string().describe('Trip start date (YYYY-MM-DD format, required)'),
        end_date: z.string().describe('Trip end date (YYYY-MM-DD format, required)'),
        total_budget: z.number().min(0).optional().describe('Total trip budget'),
        currency: z.string().length(3).default('USD').describe('Currency code (default: USD)'),
        status: z.string().default('planning').describe('Trip status (default: planning)'),
        tags: z.array(z.string()).optional().describe('Array of trip tags'),
        // Destinations
        destinations: z.array(destinationInputSchema).min(1).describe('Array of destinations to add to the trip (required, minimum 1)'),
      },
    },
    async (args) => {
      try {
        const client = getClient();

        // Extract trip data
        const { destinations: destinationInputs, ...tripData } = args;

        // Create the trip first
        const trip = await client.createTrip(tripData as TripCreate);

        // Create all destinations, rollback trip on partial failure
        const createdDestinations: DestinationResponse[] = [];
        try {
          for (let i = 0; i < destinationInputs.length; i++) {
            const destInput = destinationInputs[i];
            const destination = await client.createDestination({
              ...destInput,
              trip_id: trip.id,
              order_index: i,
            } as DestinationCreate);
            createdDestinations.push(destination);
          }
        } catch (destError) {
          // Rollback: delete the trip (cascades to any created destinations)
          try { await client.deleteTrip(trip.id); } catch { /* best-effort cleanup */ }
          throw new Error(
            `Failed creating destination ${createdDestinations.length + 1}/${destinationInputs.length}: ` +
            `${destError instanceof Error ? destError.message : String(destError)}. Trip rolled back.`
          );
        }

        const result: CreateTripWithDestinationsResult = {
          trip,
          destinations: createdDestinations,
        };

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error creating trip with destinations: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // Duplicate Trip
  server.registerTool(
    'duplicate_trip',
    {
      title: 'Duplicate Trip',
      description: 'Duplicate an existing trip including all its destinations. Optionally shift dates to a new start date.',
      inputSchema: {
        trip_id: z.number().int().positive().describe('ID of the trip to duplicate (required)'),
        new_name: z.string().min(1).max(255).describe('Name for the duplicated trip (required)'),
        new_start_date: z.string().optional().describe('New start date for the duplicated trip (YYYY-MM-DD format). If provided, all dates will be shifted accordingly.'),
      },
    },
    async (args) => {
      try {
        const client = getClient();

        // Get the original trip with destinations
        const originalTrip = await client.getTrip(args.trip_id);

        // Calculate date offset if new_start_date is provided
        let dateOffset = 0;
        if (args.new_start_date) {
          // Parse YYYY-MM-DD strings as pure dates (no timezone conversion)
          const parseDate = (s: string) => {
            const [y, m, d] = s.split('-').map(Number);
            return Date.UTC(y, m - 1, d);
          };
          dateOffset = Math.round((parseDate(args.new_start_date) - parseDate(originalTrip.start_date)) / 86_400_000);
        }

        // Timezone-safe date shifting using UTC arithmetic
        const shiftDate = (dateStr: string): string => {
          if (dateOffset === 0) return dateStr;
          const [y, m, d] = dateStr.split('-').map(Number);
          const shifted = new Date(Date.UTC(y, m - 1, d + dateOffset));
          return shifted.toISOString().split('T')[0];
        };

        // Create the new trip
        const newTrip = await client.createTrip({
          name: args.new_name,
          location: originalTrip.location,
          latitude: originalTrip.latitude,
          longitude: originalTrip.longitude,
          description: originalTrip.description,
          cover_image: originalTrip.cover_image,
          start_date: args.new_start_date || originalTrip.start_date,
          end_date: shiftDate(originalTrip.end_date),
          total_budget: originalTrip.total_budget,
          currency: originalTrip.currency,
          status: 'planning', // Reset status to planning
          tags: originalTrip.tags,
        });

        // Duplicate destinations with rollback on failure
        const newDestinations: DestinationResponse[] = [];
        try {
          for (const dest of originalTrip.destinations || []) {
            const newDest = await client.createDestination({
              trip_id: newTrip.id,
              city_name: dest.city_name,
              country: dest.country,
              arrival_date: shiftDate(dest.arrival_date),
              departure_date: shiftDate(dest.departure_date),
              latitude: dest.latitude,
              longitude: dest.longitude,
              description: dest.description,
              notes: dest.notes,
              order_index: dest.order_index,
            });
            newDestinations.push(newDest);
          }
        } catch (destError) {
          try { await client.deleteTrip(newTrip.id); } catch { /* best-effort cleanup */ }
          throw new Error(
            `Failed duplicating destination ${newDestinations.length + 1}: ` +
            `${destError instanceof Error ? destError.message : String(destError)}. Duplicate trip rolled back.`
          );
        }

        const result: DuplicateTripResult = {
          original_trip_id: args.trip_id,
          new_trip: newTrip,
          destinations: newDestinations,
        };

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error duplicating trip: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // Add POIs Batch
  server.registerTool(
    'add_pois_batch',
    {
      title: 'Add POIs Batch',
      description: 'Add multiple points of interest to a destination in a single operation. More efficient than adding POIs one by one.',
      inputSchema: {
        destination_id: z.number().int().positive().describe('Destination ID to add POIs to (required)'),
        pois: z.array(poiInputSchema).min(1).max(50).describe('Array of POIs to add (1-50 items)'),
      },
    },
    async (args) => {
      try {
        const client = getClient();
        const createdPois: POIResponse[] = [];

        for (const poiInput of args.pois) {
          const poi = await client.createPOI({
            ...poiInput,
            destination_id: args.destination_id,
          } as POICreate);
          createdPois.push(poi);
        }

        const totalEstimatedCost = createdPois.reduce(
          (sum, p) => sum + (p.estimated_cost || 0), 0
        );

        const result: AddPoisBatchResult = {
          destination_id: args.destination_id,
          created: createdPois,
          total_estimated_cost: totalEstimatedCost,
        };

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error adding POIs batch: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );
}
