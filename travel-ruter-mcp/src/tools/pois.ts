/**
 * POI (Points of Interest) management MCP tools
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getClient } from '../api/client.js';

export function registerPOITools(server: McpServer): void {
  // Add POI
  server.registerTool(
    'add_poi',
    {
      title: 'Add POI',
      description: 'Add a point of interest (restaurant, museum, attraction, etc.) to a destination',
      inputSchema: {
        destination_id: z.number().int().positive().describe('Destination ID (required)'),
        name: z.string().min(1).max(255).describe('POI name (required)'),
        category: z.string().min(1).max(100).describe('Category (e.g., restaurant, museum, park) (required)'),
        description: z.string().optional().describe('POI description'),
        latitude: z.number().min(-90).max(90).optional().describe('Latitude coordinate'),
        longitude: z.number().min(-180).max(180).optional().describe('Longitude coordinate'),
        address: z.string().max(500).optional().describe('Street address'),
        estimated_cost: z.number().min(0).optional().describe('Estimated cost'),
        currency: z.string().length(3).default('USD').describe('Currency code (default: USD)'),
        dwell_time: z.number().int().min(0).optional().describe('Expected time to spend in minutes'),
        priority: z.number().int().min(0).default(0).describe('Priority level (higher = more important)'),
        scheduled_date: z.string().optional().describe('Scheduled visit date (YYYY-MM-DD format)'),
        day_order: z.number().int().min(0).optional().describe('Order within the scheduled day'),
        external_id: z.string().optional().describe('External reference ID (e.g., Google Places ID)'),
        external_source: z.string().optional().describe('Source of external ID'),
      },
    },
    async (args) => {
      try {
        const client = getClient();
        const poi = await client.createPOI(args);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(poi, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error adding POI: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // List POIs
  server.registerTool(
    'list_pois',
    {
      title: 'List POIs',
      description: 'List all points of interest for a destination, grouped by category',
      inputSchema: {
        destination_id: z.number().int().positive().describe('Destination ID (required)'),
      },
    },
    async (args) => {
      try {
        const client = getClient();
        const pois = await client.listPOIs(args.destination_id);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(pois, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error listing POIs: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // Get POI
  server.registerTool(
    'get_poi',
    {
      title: 'Get POI',
      description: 'Get detailed information about a specific point of interest',
      inputSchema: {
        poi_id: z.number().int().positive().describe('POI ID (required)'),
      },
    },
    async (args) => {
      try {
        const client = getClient();
        const poi = await client.getPOI(args.poi_id);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(poi, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error getting POI: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // Update POI
  server.registerTool(
    'update_poi',
    {
      title: 'Update POI',
      description: 'Update an existing point of interest with new information',
      inputSchema: {
        poi_id: z.number().int().positive().describe('POI ID (required)'),
        name: z.string().min(1).max(255).optional().describe('POI name'),
        category: z.string().min(1).max(100).optional().describe('Category'),
        description: z.string().optional().describe('POI description'),
        latitude: z.number().min(-90).max(90).optional().describe('Latitude coordinate'),
        longitude: z.number().min(-180).max(180).optional().describe('Longitude coordinate'),
        address: z.string().max(500).optional().describe('Street address'),
        estimated_cost: z.number().min(0).optional().describe('Estimated cost'),
        actual_cost: z.number().min(0).optional().describe('Actual cost (after visit)'),
        currency: z.string().length(3).optional().describe('Currency code'),
        dwell_time: z.number().int().min(0).optional().describe('Expected time to spend in minutes'),
        priority: z.number().int().min(0).optional().describe('Priority level'),
        scheduled_date: z.string().optional().describe('Scheduled visit date (YYYY-MM-DD format)'),
        day_order: z.number().int().min(0).optional().describe('Order within the scheduled day'),
        external_id: z.string().optional().describe('External reference ID'),
        external_source: z.string().optional().describe('Source of external ID'),
      },
    },
    async (args) => {
      try {
        const client = getClient();
        const { poi_id, ...updateData } = args;
        const poi = await client.updatePOI(poi_id, updateData);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(poi, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error updating POI: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // Delete POI
  server.registerTool(
    'delete_poi',
    {
      title: 'Delete POI',
      description: 'Delete a point of interest from a destination',
      inputSchema: {
        poi_id: z.number().int().positive().describe('POI ID (required)'),
      },
    },
    async (args) => {
      try {
        const client = getClient();
        await client.deletePOI(args.poi_id);
        return {
          content: [{ type: 'text' as const, text: `POI ${args.poi_id} deleted successfully` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error deleting POI: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );
}
