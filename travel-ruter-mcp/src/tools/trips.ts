/**
 * Trip management MCP tools
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getClient } from '../api/client.js';

export function registerTripTools(server: McpServer): void {
  // Create Trip
  server.registerTool(
    'create_trip',
    {
      title: 'Create Trip',
      description: 'Create a new trip with the specified details',
      inputSchema: {
        name: z.string().min(1).max(255).describe('Trip name (required)'),
        location: z.string().max(255).optional().describe('Trip location/region'),
        latitude: z.number().min(-90).max(90).optional().describe('Latitude coordinate'),
        longitude: z.number().min(-180).max(180).optional().describe('Longitude coordinate'),
        description: z.string().optional().describe('Trip description'),
        cover_image: z.string().max(500).optional().describe('Cover image URL'),
        start_date: z.string().describe('Trip start date (YYYY-MM-DD format, required)'),
        end_date: z.string().describe('Trip end date (YYYY-MM-DD format, required)'),
        total_budget: z.number().min(0).optional().describe('Total trip budget'),
        currency: z.string().length(3).default('USD').describe('Currency code (3 chars, default: USD)'),
        status: z.string().default('planning').describe('Trip status (default: planning)'),
        tags: z.array(z.string()).optional().describe('Array of trip tags'),
      },
    },
    async (args) => {
      try {
        const client = getClient();
        const trip = await client.createTrip(args);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(trip, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error creating trip: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // List Trips
  server.registerTool(
    'list_trips',
    {
      title: 'List Trips',
      description: 'List all trips with optional filtering by status or search term',
      inputSchema: {
        status: z.string().optional().describe('Filter by trip status'),
        search: z.string().optional().describe('Search term for trip name'),
        limit: z.number().min(1).max(1000).default(100).describe('Maximum results to return (default: 100)'),
        offset: z.number().min(0).default(0).describe('Number of results to skip (default: 0)'),
      },
    },
    async (args) => {
      try {
        const client = getClient();
        const trips = await client.listTrips({
          status: args.status,
          search: args.search,
          skip: args.offset,
          limit: args.limit,
        });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(trips, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error listing trips: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // Get Trip
  server.registerTool(
    'get_trip',
    {
      title: 'Get Trip',
      description: 'Get detailed information about a specific trip including its destinations',
      inputSchema: {
        trip_id: z.number().int().positive().describe('Trip ID (required)'),
      },
    },
    async (args) => {
      try {
        const client = getClient();
        const trip = await client.getTrip(args.trip_id);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(trip, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error getting trip: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // Update Trip
  server.registerTool(
    'update_trip',
    {
      title: 'Update Trip',
      description: 'Update an existing trip with new information',
      inputSchema: {
        trip_id: z.number().int().positive().describe('Trip ID (required)'),
        name: z.string().min(1).max(255).optional().describe('Trip name'),
        location: z.string().max(255).optional().describe('Trip location/region'),
        latitude: z.number().min(-90).max(90).optional().describe('Latitude coordinate'),
        longitude: z.number().min(-180).max(180).optional().describe('Longitude coordinate'),
        description: z.string().optional().describe('Trip description'),
        cover_image: z.string().max(500).optional().describe('Cover image URL'),
        start_date: z.string().optional().describe('Trip start date (YYYY-MM-DD format)'),
        end_date: z.string().optional().describe('Trip end date (YYYY-MM-DD format)'),
        total_budget: z.number().min(0).optional().describe('Total trip budget'),
        currency: z.string().length(3).optional().describe('Currency code (3 chars)'),
        status: z.string().optional().describe('Trip status'),
        tags: z.array(z.string()).optional().describe('Array of trip tags'),
      },
    },
    async (args) => {
      try {
        const client = getClient();
        const { trip_id, ...updateData } = args;
        const trip = await client.updateTrip(trip_id, updateData);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(trip, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error updating trip: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // Delete Trip
  server.registerTool(
    'delete_trip',
    {
      title: 'Delete Trip',
      description: 'Delete a trip and all its associated destinations, POIs, and accommodations',
      inputSchema: {
        trip_id: z.number().int().positive().describe('Trip ID (required)'),
      },
    },
    async (args) => {
      try {
        const client = getClient();
        await client.deleteTrip(args.trip_id);
        return {
          content: [{ type: 'text' as const, text: `Trip ${args.trip_id} deleted successfully` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error deleting trip: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // Get Trip Budget
  server.registerTool(
    'get_trip_budget',
    {
      title: 'Get Trip Budget',
      description: 'Get budget summary for a trip including estimated and actual costs from all POIs',
      inputSchema: {
        trip_id: z.number().int().positive().describe('Trip ID (required)'),
      },
    },
    async (args) => {
      try {
        const client = getClient();
        const budget = await client.getTripBudget(args.trip_id);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(budget, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error getting trip budget: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );
}
