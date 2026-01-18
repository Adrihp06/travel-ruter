/**
 * Accommodation management MCP tools
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getClient } from '../api/client.js';

export function registerAccommodationTools(server: McpServer): void {
  // Add Accommodation
  server.registerTool(
    'add_accommodation',
    {
      title: 'Add Accommodation',
      description: 'Add accommodation (hotel, hostel, airbnb, etc.) to a destination',
      inputSchema: {
        destination_id: z.number().int().positive().describe('Destination ID (required)'),
        name: z.string().min(1).max(255).describe('Accommodation name (required)'),
        type: z.string().min(1).max(100).describe('Type (hotel, hostel, airbnb, apartment, resort, guesthouse, other) (required)'),
        address: z.string().max(500).optional().describe('Street address'),
        latitude: z.number().min(-90).max(90).optional().describe('Latitude coordinate'),
        longitude: z.number().min(-180).max(180).optional().describe('Longitude coordinate'),
        check_in_date: z.string().describe('Check-in date (YYYY-MM-DD format, required)'),
        check_out_date: z.string().describe('Check-out date (YYYY-MM-DD format, required)'),
        total_cost: z.number().min(0).optional().describe('Total cost of stay'),
        currency: z.string().length(3).default('USD').describe('Currency code (default: USD)'),
        booking_reference: z.string().max(255).optional().describe('Booking confirmation number'),
        booking_url: z.string().max(1000).optional().describe('URL to booking details'),
        is_paid: z.boolean().default(false).describe('Whether the accommodation has been paid'),
        description: z.string().optional().describe('Additional description or notes'),
        amenities: z.array(z.string()).optional().describe('List of amenities (wifi, pool, parking, etc.)'),
        rating: z.number().min(0).max(5).optional().describe('Rating out of 5'),
        review: z.string().optional().describe('Personal review or notes'),
      },
    },
    async (args) => {
      try {
        const client = getClient();
        const accommodation = await client.createAccommodation(args);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(accommodation, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error adding accommodation: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // List Accommodations
  server.registerTool(
    'list_accommodations',
    {
      title: 'List Accommodations',
      description: 'List all accommodations for a destination',
      inputSchema: {
        destination_id: z.number().int().positive().describe('Destination ID (required)'),
      },
    },
    async (args) => {
      try {
        const client = getClient();
        const accommodations = await client.listAccommodations(args.destination_id);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(accommodations, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error listing accommodations: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // Get Accommodation
  server.registerTool(
    'get_accommodation',
    {
      title: 'Get Accommodation',
      description: 'Get detailed information about a specific accommodation',
      inputSchema: {
        accommodation_id: z.number().int().positive().describe('Accommodation ID (required)'),
      },
    },
    async (args) => {
      try {
        const client = getClient();
        const accommodation = await client.getAccommodation(args.accommodation_id);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(accommodation, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error getting accommodation: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // Update Accommodation
  server.registerTool(
    'update_accommodation',
    {
      title: 'Update Accommodation',
      description: 'Update an existing accommodation with new information',
      inputSchema: {
        accommodation_id: z.number().int().positive().describe('Accommodation ID (required)'),
        name: z.string().min(1).max(255).optional().describe('Accommodation name'),
        type: z.string().min(1).max(100).optional().describe('Type (hotel, hostel, airbnb, etc.)'),
        address: z.string().max(500).optional().describe('Street address'),
        latitude: z.number().min(-90).max(90).optional().describe('Latitude coordinate'),
        longitude: z.number().min(-180).max(180).optional().describe('Longitude coordinate'),
        check_in_date: z.string().optional().describe('Check-in date (YYYY-MM-DD format)'),
        check_out_date: z.string().optional().describe('Check-out date (YYYY-MM-DD format)'),
        total_cost: z.number().min(0).optional().describe('Total cost of stay'),
        currency: z.string().length(3).optional().describe('Currency code'),
        booking_reference: z.string().max(255).optional().describe('Booking confirmation number'),
        booking_url: z.string().max(1000).optional().describe('URL to booking details'),
        is_paid: z.boolean().optional().describe('Whether the accommodation has been paid'),
        description: z.string().optional().describe('Additional description or notes'),
        amenities: z.array(z.string()).optional().describe('List of amenities'),
        rating: z.number().min(0).max(5).optional().describe('Rating out of 5'),
        review: z.string().optional().describe('Personal review or notes'),
      },
    },
    async (args) => {
      try {
        const client = getClient();
        const { accommodation_id, ...updateData } = args;
        const accommodation = await client.updateAccommodation(accommodation_id, updateData);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(accommodation, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error updating accommodation: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // Delete Accommodation
  server.registerTool(
    'delete_accommodation',
    {
      title: 'Delete Accommodation',
      description: 'Delete an accommodation from a destination',
      inputSchema: {
        accommodation_id: z.number().int().positive().describe('Accommodation ID (required)'),
      },
    },
    async (args) => {
      try {
        const client = getClient();
        await client.deleteAccommodation(args.accommodation_id);
        return {
          content: [{ type: 'text' as const, text: `Accommodation ${args.accommodation_id} deleted successfully` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error deleting accommodation: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );
}
