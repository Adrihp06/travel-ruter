/**
 * Smart planning MCP tools — optimization, transport comparison, daily planner, checklist
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getClient } from '../api/client.js';

export function registerPlanningTools(server: McpServer): void {

  // ============================================================================
  // Day Schedule Optimizer
  // ============================================================================

  server.registerTool(
    'optimize_day_schedule',
    {
      title: 'Optimize Day Schedule',
      description:
        'Optimize the visit order for POIs on a specific day at a destination. ' +
        'Minimizes travel time between POIs using route optimization. ' +
        'Returns an optimized schedule with estimated arrival/departure times.',
      inputSchema: {
        destination_id: z.number().int().positive().describe('Destination ID (required)'),
        day_number: z.number().int().min(1).describe('Day number to optimize (1-indexed, required)'),
        start_lat: z.number().min(-90).max(90).describe('Starting location latitude (e.g., hotel)'),
        start_lon: z.number().min(-180).max(180).describe('Starting location longitude'),
        start_time: z.string().default('08:00').describe('Day start time HH:MM (default: 08:00)'),
      },
    },
    async (args) => {
      try {
        const client = getClient();
        const result = await client.optimizeDaySchedule(
          args.destination_id,
          args.day_number,
          { lat: args.start_lat, lon: args.start_lon },
          args.start_time
        );

        const lines: string[] = [];
        lines.push(`## Optimized Schedule — Day ${args.day_number}`);
        lines.push(`🚶 Total travel: ${result.total_distance_km.toFixed(1)} km, ${result.total_duration_minutes} min`);
        lines.push('');

        if (result.schedule && result.schedule.length > 0) {
          for (const poi of result.schedule) {
            lines.push(`${poi.estimated_arrival}–${poi.estimated_departure} | **${poi.name}** (${poi.category}) — ${poi.dwell_time}min`);
          }
        } else {
          lines.push('No POIs scheduled for this day. Add POIs with scheduled_date first.');
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error optimizing schedule: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================================================
  // Compare Transport Modes
  // ============================================================================

  server.registerTool(
    'compare_transport',
    {
      title: 'Compare Transport Modes',
      description:
        'Compare different transport modes between two destinations. ' +
        'Calculates travel time, distance, and warnings for each mode side-by-side. ' +
        'Helps decide the best way to travel between cities.',
      inputSchema: {
        from_destination_id: z.number().int().positive().describe('Origin destination ID (required)'),
        to_destination_id: z.number().int().positive().describe('Target destination ID (required)'),
        modes: z.array(z.enum(['plane', 'car', 'train', 'bus', 'ferry'])).min(2).max(5)
          .default(['train', 'car', 'bus'])
          .describe('Transport modes to compare (default: train, car, bus)'),
      },
    },
    async (args) => {
      try {
        const client = getClient();

        const results: Array<{
          mode: string;
          distance_km: number | null;
          duration_minutes: number | null;
          duration_text: string;
          is_fallback: boolean;
        }> = [];

        for (const mode of args.modes) {
          try {
            const segment = await client.calculateTravelSegment(
              args.from_destination_id,
              args.to_destination_id,
              { travel_mode: mode }
            );
            const raw = segment as unknown as Record<string, unknown>;
            const dur = raw.duration_minutes as number | null;
            const hours = dur ? Math.floor(dur / 60) : 0;
            const mins = dur ? dur % 60 : 0;
            results.push({
              mode,
              distance_km: raw.distance_km as number | null,
              duration_minutes: dur,
              duration_text: dur ? `${hours}h ${mins}m` : 'N/A',
              is_fallback: (raw.is_fallback as boolean) || false,
            });
          } catch {
            results.push({
              mode,
              distance_km: null,
              duration_minutes: null,
              duration_text: 'Not available',
              is_fallback: false,
            });
          }
        }

        // Sort by duration (fastest first)
        results.sort((a, b) => (a.duration_minutes || Infinity) - (b.duration_minutes || Infinity));

        const lines: string[] = [];
        lines.push('## Transport Comparison\n');
        lines.push('| Mode | Duration | Distance | Notes |');
        lines.push('|------|----------|----------|-------|');

        for (const r of results) {
          const dist = r.distance_km ? `${r.distance_km.toFixed(0)} km` : 'N/A';
          const notes: string[] = [];
          if (r.is_fallback) notes.push('⚠️ fallback route');
          if (r.duration_minutes) {
            if (r.mode === 'car' && r.duration_minutes > 240) notes.push('⚠️ long drive');
            if (r.mode === 'train' && r.duration_minutes > 360) notes.push('⚠️ long train');
            if (r.mode === 'bus' && r.duration_minutes > 180) notes.push('⚠️ long bus');
          }
          const fastest = results.indexOf(r) === 0 ? '🏆 ' : '';
          lines.push(`| ${fastest}${r.mode} | ${r.duration_text} | ${dist} | ${notes.join(', ') || '—'} |`);
        }

        if (results[0]?.duration_minutes) {
          lines.push(`\n✅ **Recommended: ${results[0].mode}** (${results[0].duration_text})`);
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error comparing transport: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================================================
  // Bulk Schedule POIs
  // ============================================================================

  server.registerTool(
    'schedule_pois',
    {
      title: 'Schedule POIs',
      description:
        'Bulk-assign dates and order to multiple POIs. Pass an array of POI assignments ' +
        'to schedule them across days efficiently.',
      inputSchema: {
        assignments: z.array(z.object({
          poi_id: z.number().int().positive().describe('POI ID'),
          scheduled_date: z.string().describe('Date to schedule (YYYY-MM-DD)'),
          day_order: z.number().int().min(0).describe('Order within the day (0-based)'),
        })).min(1).max(100).describe('Array of POI schedule assignments (required)'),
      },
    },
    async (args) => {
      try {
        const client = getClient();
        let updated = 0;
        const errors: string[] = [];

        for (const assignment of args.assignments) {
          try {
            await client.updatePOI(assignment.poi_id, {
              scheduled_date: assignment.scheduled_date,
              day_order: assignment.day_order,
            });
            updated++;
          } catch (e) {
            errors.push(`POI ${assignment.poi_id}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }

        const msg = `✅ Scheduled ${updated}/${args.assignments.length} POIs.`;
        const errMsg = errors.length > 0 ? `\n⚠️ Errors:\n${errors.join('\n')}` : '';
        return { content: [{ type: 'text' as const, text: msg + errMsg }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error scheduling POIs: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================================================
  // Daily Planner
  // ============================================================================

  server.registerTool(
    'get_daily_plan',
    {
      title: 'Get Daily Plan',
      description:
        'Get a complete daily itinerary for a specific date — showing all POIs, ' +
        'accommodation, and travel details for that day. Combines trip data into a focused daily view.',
      inputSchema: {
        trip_id: z.number().int().positive().describe('Trip ID (required)'),
        date: z.string().describe('Date to plan for (YYYY-MM-DD, required)'),
      },
    },
    async (args) => {
      try {
        const client = getClient();
        const trip = await client.getTrip(args.trip_id);

        // Find which destination this date falls in
        const dest = trip.destinations?.find(d =>
          d.arrival_date <= args.date && d.departure_date >= args.date
        );

        if (!dest) {
          return { content: [{ type: 'text' as const, text: `No destination found for ${args.date}. Trip dates: ${trip.start_date} → ${trip.end_date}` }] };
        }

        const lines: string[] = [];
        lines.push(`## 📅 ${args.date} — ${dest.city_name}${dest.country ? ', ' + dest.country : ''}`);
        lines.push('');

        // Accommodation for this day
        try {
          const accommodations = await client.listAccommodations(dest.id);
          const todayAccom = accommodations.find(a =>
            a.check_in_date <= args.date && a.check_out_date > args.date
          );
          if (todayAccom) {
            lines.push(`🏨 **${todayAccom.name}** (${todayAccom.type})`);
            if (todayAccom.address) lines.push(`   ${todayAccom.address}`);
            lines.push('');
          }
        } catch { /* ignore */ }

        // POIs scheduled for this date
        try {
          const poisByCategory = await client.listPOIs(dest.id);
          const allPois = poisByCategory.flatMap(c => c.pois || []);
          const todayPois = allPois
            .filter(p => p.scheduled_date === args.date)
            .sort((a, b) => (a.day_order || 0) - (b.day_order || 0));

          if (todayPois.length > 0) {
            let totalCost = 0;
            let totalTime = 0;
            lines.push('### Activities');
            for (const poi of todayPois) {
              const cost = poi.estimated_cost ? `€${poi.estimated_cost}` : 'free';
              const time = poi.dwell_time ? `${poi.dwell_time}min` : '';
              lines.push(`${(poi.day_order || 0) + 1}. **${poi.name}** (${poi.category}) — ${cost}${time ? ' · ' + time : ''}`);
              if (poi.address) lines.push(`   📍 ${poi.address}`);
              totalCost += poi.estimated_cost || 0;
              totalTime += poi.dwell_time || 0;
            }
            lines.push('');
            lines.push(`💰 Estimated day cost: €${totalCost} · ⏱️ Activity time: ${Math.floor(totalTime / 60)}h ${totalTime % 60}m`);
          } else {
            lines.push('📋 No POIs scheduled for this day. Use `schedule_pois` to assign activities.');
          }
        } catch { /* ignore */ }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error getting daily plan: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================================================
  // Pre-Departure Checklist
  // ============================================================================

  server.registerTool(
    'get_trip_checklist',
    {
      title: 'Get Trip Checklist',
      description:
        'Generate a pre-departure checklist by analyzing the trip for missing information, ' +
        'unscheduled POIs, missing accommodations, and other potential issues.',
      inputSchema: {
        trip_id: z.number().int().positive().describe('Trip ID (required)'),
      },
    },
    async (args) => {
      try {
        const client = getClient();
        const trip = await client.getTrip(args.trip_id);
        const budget = await client.getTripBudget(args.trip_id);

        const issues: string[] = [];
        const ok: string[] = [];

        // Check trip basics
        if (!trip.total_budget || trip.total_budget === 0) {
          issues.push('💰 No budget set for the trip');
        } else {
          ok.push(`💰 Budget: €${budget.estimated_total} / €${budget.total_budget}`);
        }

        if (!trip.location) issues.push('📍 No trip location set');

        // Check each destination
        let totalPois = 0;
        let unscheduledPois = 0;
        let missingAccommodation = 0;

        for (const dest of trip.destinations || []) {
          // Check for accommodations
          try {
            const accommodations = await client.listAccommodations(dest.id);
            if (accommodations.length === 0) {
              issues.push(`🏨 No accommodation for ${dest.city_name} (${dest.arrival_date} → ${dest.departure_date})`);
              missingAccommodation++;
            } else {
              ok.push(`🏨 ${dest.city_name}: ${accommodations[0].name}`);
            }
          } catch { /* ignore */ }

          // Check POIs
          try {
            const poisByCategory = await client.listPOIs(dest.id);
            const pois = poisByCategory.flatMap(c => c.pois || []);
            totalPois += pois.length;
            const unscheduled = pois.filter(p => !p.scheduled_date);
            unscheduledPois += unscheduled.length;
            if (pois.length === 0) {
              issues.push(`📋 No activities planned for ${dest.city_name}`);
            }
          } catch { /* ignore */ }

          // Check coordinates
          if (!dest.latitude || !dest.longitude) {
            issues.push(`📍 ${dest.city_name} missing coordinates (geocoding needed)`);
          }
        }

        if (unscheduledPois > 0) {
          issues.push(`📅 ${unscheduledPois}/${totalPois} POIs not yet scheduled to specific dates`);
        }

        // Check travel segments
        try {
          const segments = await client.getTripTravelSegments(args.trip_id);
          const raw = segments as unknown as Record<string, unknown>;
          const segs = raw.segments as unknown[];
          if (!segs || segs.length === 0) {
            issues.push('🚂 No travel segments calculated between destinations');
          } else {
            ok.push(`🚂 ${segs.length} travel segments planned`);
          }
        } catch { /* ignore */ }

        // Build output
        const lines: string[] = [];
        lines.push(`# Pre-Departure Checklist: ${trip.name}`);
        lines.push(`📅 ${trip.start_date} → ${trip.end_date}`);
        lines.push('');

        if (issues.length > 0) {
          lines.push(`## ⚠️ Action Required (${issues.length} items)`);
          issues.forEach(i => lines.push(`- ${i}`));
          lines.push('');
        }

        if (ok.length > 0) {
          lines.push(`## ✅ Ready (${ok.length} items)`);
          ok.forEach(i => lines.push(`- ${i}`));
        }

        if (issues.length === 0) {
          lines.push('\n🎉 **Trip looks good to go!** All major items checked.');
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error generating checklist: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );
}
