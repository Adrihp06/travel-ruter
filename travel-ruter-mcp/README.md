# Travel-Ruter MCP Server

An MCP (Model Context Protocol) server that exposes the Travel-Ruter API endpoints as tools, enabling Claude Code to programmatically create and manage trips, destinations, POIs, and accommodations through natural conversation.

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Installation Tutorial](#installation-tutorial)
- [Configuration](#configuration)
- [Usage Tutorial](#usage-tutorial)
- [Available Tools](#available-tools)
- [Example Conversations](#example-conversations)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [API Compatibility](#api-compatibility)

## Features

- **Trip Management**: Create, list, update, delete trips with budget tracking
- **Destination Management**: Add destinations to trips, reorder them with automatic date adjustment
- **POI Management**: Add points of interest (restaurants, museums, attractions) to destinations
- **Accommodation Management**: Track hotels, hostels, and Airbnbs for each destination
- **Travel Segments**: Calculate travel time and distance between destinations
- **Batch Operations**: Create trips with destinations in one call, duplicate existing trips

## Quick Start

```bash
# 1. Clone and build
cd travel-ruter-mcp
npm install
npm run build

# 2. Add to Claude Code config (~/.claude.json or settings)
# See Configuration section below

# 3. Start using with Claude Code!
```

## Installation Tutorial

### Prerequisites

Before installing the MCP server, ensure you have:

1. **Node.js 18.0.0 or higher**
   ```bash
   node --version  # Should be v18.0.0 or higher
   ```

2. **Travel-Ruter API running**
   ```bash
   # The API should be accessible at http://localhost:8000
   curl http://localhost:8000/api/v1/trips/
   ```

### Step 1: Install Dependencies

Navigate to the MCP server directory and install dependencies:

```bash
cd travel-ruter-mcp
npm install
```

This will install:
- `@modelcontextprotocol/sdk` - The official MCP SDK
- `zod` - Schema validation library

### Step 2: Build the Server

Compile TypeScript to JavaScript:

```bash
npm run build
```

This creates the `dist/` folder with compiled JavaScript files.

### Step 3: Verify the Build

Test that the server starts correctly:

```bash
node dist/index.js
```

You should see:
```
Travel-Ruter MCP Server started
API URL: http://localhost:8000/api/v1
```

Press `Ctrl+C` to stop.

### Step 4: Configure Claude Code

Add the MCP server to your Claude Code configuration.

#### For Claude Code CLI

Edit `~/.claude.json` (create if it doesn't exist):

```json
{
  "mcpServers": {
    "travel-ruter": {
      "command": "node",
      "args": ["/absolute/path/to/travel-ruter-mcp/dist/index.js"],
      "env": {
        "TRAVEL_RUTER_API_URL": "http://localhost:8000/api/v1"
      }
    }
  }
}
```

#### For Claude Desktop App

Edit the appropriate config file for your OS:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "travel-ruter": {
      "command": "node",
      "args": ["/absolute/path/to/travel-ruter-mcp/dist/index.js"],
      "env": {
        "TRAVEL_RUTER_API_URL": "http://localhost:8000/api/v1"
      }
    }
  }
}
```

**Important**: Replace `/absolute/path/to/` with the actual absolute path to your installation.

### Step 5: Restart Claude Code

After updating the configuration, restart Claude Code to load the MCP server.

### Step 6: Verify Installation

Ask Claude to list trips:

```
You: List all my trips
Claude: [Uses list_trips tool and shows results]
```

If you see trip data (or an empty list), the installation is successful!

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TRAVEL_RUTER_API_URL` | Base URL for the Travel-Ruter API | `http://localhost:8000/api/v1` |

### Docker Deployment

If your Travel-Ruter API runs in Docker, you may need to use the host machine's IP:

```json
{
  "mcpServers": {
    "travel-ruter": {
      "command": "node",
      "args": ["/path/to/travel-ruter-mcp/dist/index.js"],
      "env": {
        "TRAVEL_RUTER_API_URL": "http://host.docker.internal:8000/api/v1"
      }
    }
  }
}
```

## Usage Tutorial

### Basic Workflow

The typical workflow for planning a trip with Claude is:

1. **Create a trip** - Set the name, dates, and budget
2. **Add destinations** - Add cities/places you'll visit
3. **Add POIs** - Add attractions, restaurants, activities
4. **Add accommodations** - Add hotels/hostels for each destination
5. **Calculate travel** - Get travel times between destinations

### Tutorial: Planning a Weekend Trip to Paris

#### Step 1: Create the Trip

```
You: Create a trip to Paris from March 20 to March 23, 2026. Budget is $2000.

Claude: I'll create that trip for you.
[Uses create_trip tool]

Created trip "Paris Getaway" (ID: 5)
- Start: March 20, 2026
- End: March 23, 2026
- Budget: $2,000
- Duration: 3 nights
```

#### Step 2: Add the Destination

```
You: Add Paris as a destination

Claude: [Uses add_destination tool]

Added destination: Paris, France
- Arrival: March 20, 2026
- Departure: March 23, 2026
```

#### Step 3: Add Points of Interest

```
You: Add the Eiffel Tower, Louvre Museum, and a good restaurant

Claude: [Uses add_poi tool for each]

Added 3 POIs to Paris:
1. Eiffel Tower (landmark)
   - Estimated cost: €25
   - Time needed: 2 hours

2. Louvre Museum (museum)
   - Estimated cost: €17
   - Time needed: 4 hours

3. Le Jules Verne (restaurant)
   - Estimated cost: €150
   - Time needed: 2 hours
```

#### Step 4: Add Accommodation

```
You: Add Hotel Le Marais for all 3 nights, costs $450 total

Claude: [Uses add_accommodation tool]

Added accommodation:
- Hotel Le Marais (hotel)
- Check-in: March 20
- Check-out: March 23
- Total cost: $450
```

#### Step 5: Check Your Budget

```
You: What's my trip budget looking like?

Claude: [Uses get_trip_budget tool]

Budget Summary:
- Total Budget: $2,000
- Estimated Costs: $642
- Remaining: $1,358
- Used: 32%
```

### Advanced Usage

#### Creating a Multi-City Trip in One Command

```
You: Create a 2-week Italy trip starting June 1st with Rome (4 days),
Florence (3 days), Venice (2 days), and Milan (3 days)

Claude: [Uses create_trip_with_destinations tool]

Created "Italy Adventure" with 4 destinations:
1. Rome (June 1-5)
2. Florence (June 5-8)
3. Venice (June 8-10)
4. Milan (June 10-13)
```

#### Duplicating a Trip

```
You: I loved my Japan trip! Duplicate it for next year starting April 20, 2027

Claude: [Uses duplicate_trip tool]

Duplicated trip as "Japan Adventure 2027"
- All destinations copied
- Dates shifted to April 20 - May 13, 2027
```

#### Reordering Destinations

```
You: Actually, let's visit Kyoto before Osaka

Claude: [Uses reorder_destinations tool]

Reordered destinations:
1. Tokyo (Apr 17-20)
2. Kyoto (Apr 20-24) ← moved up
3. Osaka (Apr 24-27) ← moved down
4. Hiroshima (Apr 27-29)

Dates automatically adjusted!
```

## Available Tools

### Trip Management (6 tools)

| Tool | Description | Required Parameters |
|------|-------------|---------------------|
| `create_trip` | Create a new trip | `name`, `start_date`, `end_date` |
| `list_trips` | List all trips | None |
| `get_trip` | Get trip with destinations | `trip_id` |
| `update_trip` | Update trip properties | `trip_id` |
| `delete_trip` | Delete a trip | `trip_id` |
| `get_trip_budget` | Get budget summary | `trip_id` |

### Destination Management (6 tools)

| Tool | Description | Required Parameters |
|------|-------------|---------------------|
| `add_destination` | Add destination to trip | `trip_id`, `city_name`, `arrival_date`, `departure_date` |
| `list_destinations` | List trip destinations | `trip_id` |
| `get_destination` | Get destination details | `destination_id` |
| `update_destination` | Update destination | `destination_id` |
| `delete_destination` | Remove destination | `destination_id` |
| `reorder_destinations` | Reorder destinations | `trip_id`, `destination_ids` |

### POI Management (5 tools)

| Tool | Description | Required Parameters |
|------|-------------|---------------------|
| `add_poi` | Add point of interest | `destination_id`, `name`, `category` |
| `list_pois` | List POIs (by category) | `destination_id` |
| `get_poi` | Get POI details | `poi_id` |
| `update_poi` | Update POI | `poi_id` |
| `delete_poi` | Remove POI | `poi_id` |

### Accommodation Management (5 tools)

| Tool | Description | Required Parameters |
|------|-------------|---------------------|
| `add_accommodation` | Add accommodation | `destination_id`, `name`, `type`, `check_in_date`, `check_out_date` |
| `list_accommodations` | List accommodations | `destination_id` |
| `get_accommodation` | Get accommodation details | `accommodation_id` |
| `update_accommodation` | Update accommodation | `accommodation_id` |
| `delete_accommodation` | Remove accommodation | `accommodation_id` |

### Travel Segments (5 tools)

| Tool | Description | Required Parameters |
|------|-------------|---------------------|
| `calculate_travel_segment` | Calculate travel between destinations | `from_destination_id`, `to_destination_id`, `travel_mode` |
| `get_travel_segment` | Get existing segment | `from_destination_id`, `to_destination_id` |
| `get_trip_segments` | Get all trip segments | `trip_id` |
| `recalculate_trip_segments` | Recalculate all segments | `trip_id` |
| `delete_travel_segment` | Remove segment | `segment_id` |

### Batch Operations (2 tools)

| Tool | Description | Required Parameters |
|------|-------------|---------------------|
| `create_trip_with_destinations` | Create trip with destinations | `name`, `start_date`, `end_date`, `destinations[]` |
| `duplicate_trip` | Duplicate a trip | `trip_id`, `new_name` |

## Example Conversations

### Planning a Honeymoon

```
You: Plan a 2-week honeymoon to Greece starting September 1st.
     We want to visit Santorini, Mykonos, and Athens. Budget is $8000.

Claude: I'll create a romantic Greece honeymoon for you!

[Creates trip, adds 3 destinations with appropriate durations]
[Adds romantic POIs: sunset spots, fine dining, beaches]
[Adds luxury accommodations for each destination]

Your Greece Honeymoon is ready:
- Santorini (Sep 1-6): Cave hotel, sunset dinner at Oia
- Mykonos (Sep 6-10): Beach resort, Little Venice
- Athens (Sep 10-15): Boutique hotel, Acropolis, Plaka
Total estimated: $6,800 (within budget!)
```

### Business Trip with Sightseeing

```
You: I have meetings in Tokyo on May 5-6 and Osaka on May 8.
     Add some sightseeing for the evenings and weekend.

Claude: [Creates trip May 4-9]
[Adds Tokyo and Osaka destinations]
[Adds POIs with scheduling for evenings/weekend]

Your Business + Leisure Trip:
- May 4: Arrive Tokyo, evening at Shibuya
- May 5-6: Meetings (free evenings for Ginza, Roppongi)
- May 7: Day trip to Hakone or Tokyo sightseeing
- May 8: Travel to Osaka, afternoon meeting, Dotonbori evening
- May 9: Morning at Osaka Castle, depart
```

## Development

### Build Commands

```bash
npm run build    # Compile TypeScript
npm run dev      # Watch mode for development
npm run lint     # Run linter
```

### Project Structure

```
travel-ruter-mcp/
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── tools/
│   │   ├── trips.ts          # Trip-related tools
│   │   ├── destinations.ts   # Destination tools
│   │   ├── pois.ts           # POI tools
│   │   ├── accommodations.ts # Accommodation tools
│   │   ├── segments.ts       # Travel segment tools
│   │   └── batch.ts          # Batch operation tools
│   ├── api/
│   │   └── client.ts         # HTTP client for travel-ruter API
│   └── types/
│       └── schemas.ts        # TypeScript types matching API schemas
├── dist/                     # Compiled JavaScript (after build)
├── package.json
├── tsconfig.json
└── README.md
```

### Adding New Tools

1. Create or edit a file in `src/tools/`
2. Use `server.registerTool()` with:
   - Tool name
   - Title and description
   - Input schema (using Zod)
   - Handler function
3. Register in `src/index.ts`
4. Rebuild with `npm run build`

## Troubleshooting

### "Connection refused" Error

**Problem**: The MCP server can't connect to the Travel-Ruter API.

**Solution**:
1. Verify the API is running: `curl http://localhost:8000/api/v1/trips/`
2. Check the `TRAVEL_RUTER_API_URL` in your config
3. If using Docker, try `host.docker.internal` instead of `localhost`

### "Tool not found" Error

**Problem**: Claude doesn't recognize travel-ruter tools.

**Solution**:
1. Verify the config path is correct (use absolute path)
2. Restart Claude Code after config changes
3. Check that `dist/index.js` exists (run `npm run build`)

### "Permission denied" Error

**Problem**: Can't execute the server.

**Solution**:
```bash
chmod +x dist/index.js
```

### Server Doesn't Start

**Problem**: No output when starting the server.

**Solution**:
1. Check Node.js version: `node --version` (need 18+)
2. Reinstall dependencies: `rm -rf node_modules && npm install`
3. Rebuild: `npm run build`

### Viewing Server Logs

The MCP server logs to stderr. To see logs when running via Claude:

```bash
# Test the server directly
node dist/index.js 2>&1
```

## API Compatibility

This MCP server is designed to work with the Travel-Ruter API v1. It proxies requests to:

| Endpoint | Methods |
|----------|---------|
| `/api/v1/trips` | GET, POST |
| `/api/v1/trips/{id}` | GET, PUT, DELETE |
| `/api/v1/trips/{id}/budget` | GET |
| `/api/v1/trips/{id}/destinations` | GET |
| `/api/v1/trips/{id}/destinations/reorder` | POST |
| `/api/v1/trips/{id}/travel-segments` | GET |
| `/api/v1/destinations` | POST |
| `/api/v1/destinations/{id}` | GET, PUT, DELETE |
| `/api/v1/destinations/{id}/pois` | GET |
| `/api/v1/destinations/{id}/accommodations` | GET |
| `/api/v1/destinations/{id}/travel-segment/{id}` | GET, POST |
| `/api/v1/pois` | POST |
| `/api/v1/pois/{id}` | GET, PUT, DELETE |
| `/api/v1/accommodations` | POST |
| `/api/v1/accommodations/{id}` | GET, PUT, DELETE |
| `/api/v1/travel-segments/{id}` | DELETE |

## License

MIT
