/**
 * Notes management MCP tools — create, list, update, delete, export
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getClient } from '../api/client.js';

export function registerNoteTools(server: McpServer): void {

  server.registerTool(
    'add_note',
    {
      title: 'Add Note',
      description:
        'Create a travel note for a trip. Notes can be general, linked to a destination, day, or POI. ' +
        'Use for travel tips, booking info, personal observations, or itinerary reminders.',
      inputSchema: {
        trip_id: z.number().int().positive().describe('Trip ID (required)'),
        title: z.string().min(1).max(255).describe('Note title (required)'),
        content: z.string().optional().describe('Note content (markdown/text)'),
        note_type: z.enum(['general', 'destination', 'day', 'poi']).default('general').describe('Note type'),
        destination_id: z.number().int().positive().optional().describe('Link to a destination'),
        day_number: z.number().int().min(1).optional().describe('Link to a day number (1-indexed)'),
        poi_id: z.number().int().positive().optional().describe('Link to a POI'),
        is_pinned: z.boolean().default(false).describe('Pin the note for visibility'),
        tags: z.array(z.string()).optional().describe('Tags for categorization'),
      },
    },
    async (args) => {
      try {
        const client = getClient();
        const { trip_id, ...noteData } = args;
        const note = await client.createNote(trip_id, noteData);
        return {
          content: [{ type: 'text' as const, text: `✅ Note created: "${note.title}" (id: ${note.id}, type: ${note.note_type})` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error creating note: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'list_notes',
    {
      title: 'List Notes',
      description: 'List all notes for a trip, optionally filtered by destination, day, or type.',
      inputSchema: {
        trip_id: z.number().int().positive().describe('Trip ID (required)'),
        destination_id: z.number().int().positive().optional().describe('Filter by destination'),
        day_number: z.number().int().min(1).optional().describe('Filter by day number'),
        note_type: z.enum(['general', 'destination', 'day', 'poi']).optional().describe('Filter by type'),
      },
    },
    async (args) => {
      try {
        const client = getClient();
        const { trip_id, ...filters } = args;
        const notes = await client.listNotes(trip_id, filters);

        if (notes.length === 0) {
          return { content: [{ type: 'text' as const, text: 'No notes found for this trip.' }] };
        }

        const summary = notes.map((n, i) => {
          const pin = n.is_pinned ? '📌 ' : '';
          const tags = n.tags?.length ? ` [${n.tags.join(', ')}]` : '';
          return `${i + 1}. ${pin}**${n.title}** (${n.note_type}, id: ${n.id})${tags}`;
        }).join('\n');

        return { content: [{ type: 'text' as const, text: `${notes.length} notes:\n\n${summary}` }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error listing notes: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'update_note',
    {
      title: 'Update Note',
      description: 'Update an existing note. Only provide fields you want to change.',
      inputSchema: {
        note_id: z.number().int().positive().describe('Note ID (required)'),
        title: z.string().min(1).max(255).optional().describe('New title'),
        content: z.string().optional().describe('New content'),
        is_pinned: z.boolean().optional().describe('Pin/unpin the note'),
        tags: z.array(z.string()).optional().describe('New tags'),
      },
    },
    async (args) => {
      try {
        const client = getClient();
        const { note_id, ...updates } = args;
        const note = await client.updateNote(note_id, updates);
        return {
          content: [{ type: 'text' as const, text: `✅ Note updated: "${note.title}" (id: ${note.id})` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error updating note: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'delete_note',
    {
      title: 'Delete Note',
      description: 'Delete a note by ID.',
      inputSchema: {
        note_id: z.number().int().positive().describe('Note ID (required)'),
      },
    },
    async (args) => {
      try {
        const client = getClient();
        await client.deleteNote(args.note_id);
        return {
          content: [{ type: 'text' as const, text: `✅ Note ${args.note_id} deleted.` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error deleting note: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'export_notes',
    {
      title: 'Export Notes',
      description: 'Export all trip notes as formatted markdown. Returns the full markdown content.',
      inputSchema: {
        trip_id: z.number().int().positive().describe('Trip ID (required)'),
      },
    },
    async (args) => {
      try {
        const client = getClient();
        const markdown = await client.exportNotesMarkdown(args.trip_id);
        return { content: [{ type: 'text' as const, text: markdown || 'No notes to export.' }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error exporting notes: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );
}
