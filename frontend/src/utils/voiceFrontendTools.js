/**
 * Voice Frontend Tool Registry
 *
 * When the voice agent calls a frontend tool, this module validates
 * and executes it by calling Zustand stores directly (no CustomEvents).
 */

import useMapStore from '../stores/useMapStore';

// ---------------------------------------------------------------------------
// Whitelists
// ---------------------------------------------------------------------------

const ALLOWED_ROUTES = ['/trips', '/settings', '/ai-settings'];
const ALLOWED_ROUTE_PATTERNS = [/^\/trips\/\d+$/];
const ALLOWED_MODAL_TYPES = ['poi_detail', 'add_poi', 'trip_summary'];

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

const TOOL_HANDLERS = {
  navigate_to: async ({ page }) => {
    const isAllowed =
      ALLOWED_ROUTES.includes(page) ||
      ALLOWED_ROUTE_PATTERNS.some((p) => p.test(page));

    if (!isAllowed) return { success: false, error: `Route not allowed: ${page}` };

    if (window.__voiceNavigate) {
      window.__voiceNavigate(page);
      return { success: true, navigatedTo: page };
    }
    return { success: false, error: 'Navigation not available' };
  },

  highlight_poi: async ({ poi_id }) => {
    if (!poi_id) return { success: false, error: 'Invalid poi_id' };
    // Find and highlight the POI element in the DOM
    const el = document.querySelector(`[data-poi-id="${poi_id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      el.classList.add('ring-2', 'ring-amber-500');
      setTimeout(() => el.classList.remove('ring-2', 'ring-amber-500'), 3000);
    }
    return { success: true, highlighted: poi_id };
  },

  show_on_map: async ({ latitude, longitude, zoom }) => {
    if (
      typeof latitude !== 'number' || typeof longitude !== 'number' ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180
    ) {
      return { success: false, error: 'Invalid coordinates' };
    }
    // Call store directly — Mapbox uses [lng, lat] order
    console.log('[voiceFrontendTools] show_on_map:', longitude, latitude, zoom);
    useMapStore.getState().voiceFlyTo(longitude, latitude, zoom || 14);
    return { success: true, location: { latitude, longitude } };
  },

  open_modal: async ({ type, data }) => {
    if (!ALLOWED_MODAL_TYPES.includes(type)) {
      return { success: false, error: `Modal type not allowed: ${type}` };
    }
    window.dispatchEvent(
      new CustomEvent('voice-open-modal', { detail: { type, data } }),
    );
    return { success: true, opened: type };
  },

  scroll_to: async ({ element_id }) => {
    const el = document.getElementById(element_id);
    if (!el) return { success: false, error: `Element not found: ${element_id}` };
    el.scrollIntoView({ behavior: 'smooth' });
    return { success: true };
  },

  show_notification: async ({ message, type = 'info' }) => {
    console.log(`[Voice notification] ${type}: ${message}`);
    return { success: true };
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function executeFrontendTool(name, args) {
  const handler = TOOL_HANDLERS[name];
  if (!handler) return { success: false, error: `Unknown frontend tool: ${name}` };
  try {
    console.log('[voiceFrontendTools] Executing:', name, args);
    return await handler(args);
  } catch (err) {
    console.error('[voiceFrontendTools] Error:', name, err);
    return { success: false, error: err.message };
  }
}

export const FRONTEND_TOOL_NAMES = new Set(Object.keys(TOOL_HANDLERS));
