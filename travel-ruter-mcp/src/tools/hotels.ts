/**
 * Hotel search and discovery MCP tools
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getClient } from '../api/client.js';

export function registerHotelTools(server: McpServer): void {

  server.registerTool(
    'search_hotels',
    {
      title: 'Search Hotels',
      description:
        'Search for hotels near coordinates using Google Places. ' +
        'Returns hotel names, ratings, addresses, and photos. Use search_location first to get coordinates if needed. ' +
        'Supports keyword filtering (e.g., "luxury", "budget", "boutique").',
      inputSchema: {
        latitude: z.number().min(-90).max(90).describe('Center latitude (required)'),
        longitude: z.number().min(-180).max(180).describe('Center longitude (required)'),
        radius: z.number().int().min(500).max(50000).default(5000).describe('Search radius in meters (default: 5000)'),
        keyword: z.string().optional().describe('Keyword filter: "luxury", "budget", "boutique", "hostel", etc.'),
        max_results: z.number().int().min(1).max(50).default(10).describe('Max results (default: 10)'),
      },
    },
    async (args) => {
      try {
        const client = getClient();
        const response = await client.searchHotels(args.latitude, args.longitude, {
          radius: args.radius,
          keyword: args.keyword,
          max_results: args.max_results,
        });

        if (!response.results || response.results.length === 0) {
          return { content: [{ type: 'text' as const, text: 'No hotels found in this area. Try expanding the search radius.' }] };
        }

        const summary = response.results.map((h, i) => {
          const rating = h.rating ? `⭐ ${h.rating} (${h.user_ratings_total || 0} reviews)` : 'No rating';
          return `${i + 1}. **${h.name}** — ${rating}\n   📍 ${h.address || 'No address'}\n   🆔 place_id: ${h.place_id}`;
        }).join('\n\n');

        return { content: [{ type: 'text' as const, text: `Found ${response.total} hotels:\n\n${summary}` }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error searching hotels: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'get_hotel_details',
    {
      title: 'Get Hotel Details',
      description:
        'Get detailed hotel information including reviews, website, phone, and photos. ' +
        'Use the place_id from search_hotels results.',
      inputSchema: {
        place_id: z.string().min(1).describe('Google Places ID from search_hotels results (required)'),
      },
    },
    async (args) => {
      try {
        const client = getClient();
        const hotel = await client.getHotelDetails(args.place_id);

        const lines: string[] = [];
        lines.push(`# ${hotel.name}`);
        if (hotel.rating) lines.push(`⭐ ${hotel.rating} (${hotel.user_ratings_total || 0} reviews)`);
        if (hotel.formatted_address) lines.push(`📍 ${hotel.formatted_address}`);
        if (hotel.website) lines.push(`🌐 ${hotel.website}`);
        if (hotel.phone_number) lines.push(`📞 ${hotel.phone_number}`);
        if (hotel.google_maps_url) lines.push(`🗺️ ${hotel.google_maps_url}`);
        if (hotel.latitude && hotel.longitude) lines.push(`📌 lat: ${hotel.latitude}, lng: ${hotel.longitude}`);

        if (hotel.reviews && hotel.reviews.length > 0) {
          lines.push('\n## Recent Reviews');
          for (const review of hotel.reviews.slice(0, 3)) {
            const stars = review.rating ? '⭐'.repeat(Math.round(review.rating)) : '';
            lines.push(`- ${stars} ${review.author_name || 'Anonymous'} (${review.relative_time_description || 'recently'})`);
            if (review.text) lines.push(`  "${review.text.slice(0, 200)}${review.text.length > 200 ? '...' : ''}"`);
          }
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error getting hotel details: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );
}
