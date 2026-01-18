/**
 * Destination management MCP tools
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getClient } from '../api/client.js';

export function registerDestinationTools(server: McpServer): void {
  // Add Destination
  server.registerTool(
    'add_destination',
    {
      title: 'Add Destination',
      description: 'Add a new destination to a trip',
      inputSchema: {
        trip_id: z.number().int().positive().describe('Trip ID (required)'),
        city_name: z.string().min(1).max(255).describe('City name (required)'),
        country: z.string().max(255).optional().describe('Country name'),
        arrival_date: z.string().describe('Arrival date (YYYY-MM-DD format, required)'),
        departure_date: z.string().describe('Departure date (YYYY-MM-DD format, required)'),
        latitude: z.number().min(-90).max(90).optional().describe('Latitude coordinate'),
        longitude: z.number().min(-180).max(180).optional().describe('Longitude coordinate'),
        description: z.string().optional().describe('Destination description'),
        notes: z.string().optional().describe('Additional notes'),
        name: z.string().optional().describe('Display name (optional, defaults to city_name)'),
        address: z.string().optional().describe('Full address'),
        order_index: z.number().int().min(0).optional().describe('Order position in trip'),
      },
    },
    async (args) => {
      try {
        const client = getClient();
        const destination = await client.createDestination(args);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(destination, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error adding destination: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // List Destinations
  server.registerTool(
    'list_destinations',
    {
      title: 'List Destinations',
      description: 'List all destinations for a specific trip, ordered by their sequence',
      inputSchema: {
        trip_id: z.number().int().positive().describe('Trip ID (required)'),
      },
    },
    async (args) => {
      try {
        const client = getClient();
        const destinations = await client.listDestinations(args.trip_id);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(destinations, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error listing destinations: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // Get Destination
  server.registerTool(
    'get_destination',
    {
      title: 'Get Destination',
      description: 'Get detailed information about a specific destination',
      inputSchema: {
        destination_id: z.number().int().positive().describe('Destination ID (required)'),
      },
    },
    async (args) => {
      try {
        const client = getClient();
        const destination = await client.getDestination(args.destination_id);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(destination, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error getting destination: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // Update Destination
  server.registerTool(
    'update_destination',
    {
      title: 'Update Destination',
      description: 'Update an existing destination with new information',
      inputSchema: {
        destination_id: z.number().int().positive().describe('Destination ID (required)'),
        city_name: z.string().min(1).max(255).optional().describe('City name'),
        country: z.string().max(255).optional().describe('Country name'),
        arrival_date: z.string().optional().describe('Arrival date (YYYY-MM-DD format)'),
        departure_date: z.string().optional().describe('Departure date (YYYY-MM-DD format)'),
        latitude: z.number().min(-90).max(90).optional().describe('Latitude coordinate'),
        longitude: z.number().min(-180).max(180).optional().describe('Longitude coordinate'),
        description: z.string().optional().describe('Destination description'),
        notes: z.string().optional().describe('Additional notes'),
        name: z.string().optional().describe('Display name'),
        address: z.string().optional().describe('Full address'),
        order_index: z.number().int().min(0).optional().describe('Order position in trip'),
      },
    },
    async (args) => {
      try {
        const client = getClient();
        const { destination_id, ...updateData } = args;
        const destination = await client.updateDestination(destination_id, updateData);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(destination, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error updating destination: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // Delete Destination
  server.registerTool(
    'delete_destination',
    {
      title: 'Delete Destination',
      description: 'Delete a destination and all its associated POIs and accommodations',
      inputSchema: {
        destination_id: z.number().int().positive().describe('Destination ID (required)'),
      },
    },
    async (args) => {
      try {
        const client = getClient();
        await client.deleteDestination(args.destination_id);
        return {
          content: [{ type: 'text' as const, text: `Destination ${args.destination_id} deleted successfully` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error deleting destination: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // Reorder Destinations
  server.registerTool(
    'reorder_destinations',
    {
      title: 'Reorder Destinations',
      description: 'Reorder destinations within a trip. Automatically adjusts arrival/departure dates based on new order.',
      inputSchema: {
        trip_id: z.number().int().positive().describe('Trip ID (required)'),
        destination_ids: z.array(z.number().int().positive()).min(1).describe('Ordered array of destination IDs (required)'),
      },
    },
    async (args) => {
      try {
        const client = getClient();
        const destinations = await client.reorderDestinations(args.trip_id, {
          destination_ids: args.destination_ids,
        });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(destinations, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error reordering destinations: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );
}
