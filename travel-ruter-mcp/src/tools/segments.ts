/**
 * Travel segment management MCP tools
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getClient } from '../api/client.js';

// Travel mode enum
const travelModeEnum = z.enum(['plane', 'car', 'train', 'bus', 'walk', 'bike', 'ferry']);

export function registerSegmentTools(server: McpServer): void {
  // Calculate Travel Segment
  server.registerTool(
    'calculate_travel_segment',
    {
      title: 'Calculate Travel Segment',
      description: 'Calculate and save travel segment between two destinations with distance and duration estimates',
      inputSchema: {
        from_destination_id: z.number().int().positive().describe('Origin destination ID (required)'),
        to_destination_id: z.number().int().positive().describe('Target destination ID (required)'),
        travel_mode: travelModeEnum.describe('Mode of transportation: plane, car, train, bus, walk, bike, or ferry (required)'),
      },
    },
    async (args) => {
      try {
        const client = getClient();
        const segment = await client.calculateTravelSegment(
          args.from_destination_id,
          args.to_destination_id,
          { travel_mode: args.travel_mode }
        );
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(segment, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error calculating travel segment: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // Get Travel Segment
  server.registerTool(
    'get_travel_segment',
    {
      title: 'Get Travel Segment',
      description: 'Get existing travel segment between two destinations',
      inputSchema: {
        from_destination_id: z.number().int().positive().describe('Origin destination ID (required)'),
        to_destination_id: z.number().int().positive().describe('Target destination ID (required)'),
      },
    },
    async (args) => {
      try {
        const client = getClient();
        const segment = await client.getTravelSegment(
          args.from_destination_id,
          args.to_destination_id
        );
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(segment, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error getting travel segment: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // Get Trip Travel Segments
  server.registerTool(
    'get_trip_segments',
    {
      title: 'Get Trip Segments',
      description: 'Get all travel segments for a trip showing how to travel between consecutive destinations',
      inputSchema: {
        trip_id: z.number().int().positive().describe('Trip ID (required)'),
      },
    },
    async (args) => {
      try {
        const client = getClient();
        const segments = await client.getTripTravelSegments(args.trip_id);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(segments, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error getting trip travel segments: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // Recalculate Trip Segments
  server.registerTool(
    'recalculate_trip_segments',
    {
      title: 'Recalculate Trip Segments',
      description: 'Recalculate all travel segments for a trip (useful after reordering destinations)',
      inputSchema: {
        trip_id: z.number().int().positive().describe('Trip ID (required)'),
      },
    },
    async (args) => {
      try {
        const client = getClient();
        const segments = await client.recalculateTravelSegments(args.trip_id);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(segments, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error recalculating travel segments: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // Delete Travel Segment
  server.registerTool(
    'delete_travel_segment',
    {
      title: 'Delete Travel Segment',
      description: 'Delete a travel segment between destinations',
      inputSchema: {
        segment_id: z.number().int().positive().describe('Travel segment ID (required)'),
      },
    },
    async (args) => {
      try {
        const client = getClient();
        await client.deleteTravelSegment(args.segment_id);
        return {
          content: [{ type: 'text' as const, text: `Travel segment ${args.segment_id} deleted successfully` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error deleting travel segment: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );
}
