#!/usr/bin/env node
/**
 * Travel-Ruter MCP Server
 *
 * An MCP server that exposes the Travel-Ruter API endpoints as tools,
 * enabling Claude Code to programmatically create and manage trips,
 * destinations, POIs, and accommodations.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTripTools } from './tools/trips.js';
import { registerDestinationTools } from './tools/destinations.js';
import { registerPOITools } from './tools/pois.js';
import { registerAccommodationTools } from './tools/accommodations.js';
import { registerSegmentTools } from './tools/segments.js';
import { registerBatchTools } from './tools/batch.js';

// Create the MCP server
const server = new McpServer({
  name: 'travel-ruter',
  version: '1.0.0',
});

// Register all tools
registerTripTools(server);
registerDestinationTools(server);
registerPOITools(server);
registerAccommodationTools(server);
registerSegmentTools(server);
registerBatchTools(server);

// Start the server with stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log startup message to stderr (stdout is used for MCP communication)
  console.error('Travel-Ruter MCP Server started');
  console.error(`API URL: ${process.env.TRAVEL_RUTER_API_URL || 'http://localhost:8000/api/v1'}`);
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
